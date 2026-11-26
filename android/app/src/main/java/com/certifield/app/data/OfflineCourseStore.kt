package com.certifield.app.data

import android.content.Context
import android.util.Base64
import com.certifield.app.model.CertificateRecord
import com.certifield.app.model.Course
import com.certifield.app.model.CourseProgressState
import com.certifield.app.model.CourseSubmission
import com.certifield.app.model.DownloadedCoursePackage
import com.certifield.app.model.PendingOfflineSubmission
import com.certifield.app.model.SavedAuthSession
import com.certifield.app.model.SystemBranding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest
import java.time.Instant
import java.util.concurrent.TimeUnit

class OfflineCourseStore(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val http = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val prefs = context.getSharedPreferences("certifield_prefs", Context.MODE_PRIVATE)
    private val rootDir: File = File(context.filesDir, "offline_courses").apply { mkdirs() }
    private val mediaDir: File = File(rootDir, "media").apply { mkdirs() }
    private val packagesFile = File(rootDir, "packages.json")
    private val progressFile = File(rootDir, "progress.json")
    private val pendingFile = File(rootDir, "pending_submissions.json")
    private val brandingFile = File(rootDir, "branding.json")
    private val brandingIconFile = File(rootDir, "branding_icon.bin")
    private val authSessionFile = File(rootDir, "auth_session.json")
    private val submissionsCacheFile = File(rootDir, "submissions_cache.json")
    private val certificatesCacheFile = File(rootDir, "certificates_cache.json")

    // ---- Connection String & Theme Preferences ----
    fun loadServerUrl(defaultUrl: String): String {
        val saved = prefs.getString("server_url", null)?.trim()
        return if (!saved.isNullOrEmpty()) saved else defaultUrl
    }

    fun saveServerUrl(url: String) {
        prefs.edit().putString("server_url", ApiClient.normalizeConnectionUrl(url)).apply()
    }

    fun loadDarkMode(): Boolean = prefs.getBoolean("dark_mode", false)

    fun saveDarkMode(enabled: Boolean) {
        prefs.edit().putBoolean("dark_mode", enabled).apply()
    }

    // ---- Branding Persistence (Synced Online, Used Offline) ----
    fun loadBranding(): SystemBranding {
        if (!brandingFile.exists()) return SystemBranding()
        return runCatching {
            json.decodeFromString<SystemBranding>(brandingFile.readText())
        }.getOrDefault(SystemBranding())
    }

    fun getCachedBrandingIconFile(): File? {
        return if (brandingIconFile.exists() && brandingIconFile.length() > 0L) brandingIconFile else null
    }

    suspend fun saveBranding(branding: SystemBranding, serverBaseUrl: String): SystemBranding =
        withContext(Dispatchers.IO) {
            brandingFile.writeText(json.encodeToString(branding))
            val iconUrl = branding.iconUrl.trim()
            if (iconUrl.startsWith("data:image/", ignoreCase = true) && iconUrl.contains(",")) {
                runCatching {
                    val base64Part = iconUrl.substringAfter(",", "")
                    if (base64Part.isNotEmpty() && !iconUrl.startsWith("data:image/svg+xml", ignoreCase = true)) {
                        val bytes = Base64.decode(base64Part, Base64.DEFAULT)
                        if (bytes.isNotEmpty()) {
                            brandingIconFile.writeBytes(bytes)
                        }
                    }
                }
            } else if (iconUrl.isNotEmpty() && !iconUrl.endsWith(".svg", ignoreCase = true)) {
                val resolved = if (iconUrl.startsWith("http", ignoreCase = true)) {
                    iconUrl
                } else {
                    "${ApiClient.normalizeConnectionUrl(serverBaseUrl)}$iconUrl"
                }
                if (resolved.startsWith("http", ignoreCase = true)) {
                    runCatching {
                        val req = Request.Builder().url(resolved).build()
                        http.newCall(req).execute().use { resp ->
                            if (resp.isSuccessful) {
                                val bytes = resp.body?.bytes()
                                if (bytes != null && bytes.isNotEmpty()) {
                                    brandingIconFile.writeBytes(bytes)
                                }
                            }
                        }
                    }
                }
            } else if (iconUrl == "/icon.svg") {
                val fallback = "${ApiClient.normalizeConnectionUrl(serverBaseUrl)}/pwa-192x192.png"
                runCatching {
                    val req = Request.Builder().url(fallback).build()
                    http.newCall(req).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val bytes = resp.body?.bytes()
                            if (bytes != null && bytes.isNotEmpty()) {
                                brandingIconFile.writeBytes(bytes)
                            }
                        }
                    }
                }
            }
            branding
        }

    // ---- Auth Credentials / Session Persistence for Offline Use ----
    fun loadAuthSession(): SavedAuthSession? {
        val fromFile = if (authSessionFile.exists()) {
            runCatching { json.decodeFromString<SavedAuthSession>(authSessionFile.readText()) }.getOrNull()
        } else null
        if (fromFile != null) return fromFile

        val fromPrefs = prefs.getString("auth_session", null)?.trim()
        if (!fromPrefs.isNullOrEmpty()) {
            val decoded = runCatching { json.decodeFromString<SavedAuthSession>(fromPrefs) }.getOrNull()
            if (decoded != null) {
                runCatching { authSessionFile.writeText(fromPrefs) }
                return decoded
            }
        }
        return null
    }

    fun saveAuthSession(session: SavedAuthSession) {
        val encoded = json.encodeToString(session)
        authSessionFile.writeText(encoded)
        prefs.edit().putString("auth_session", encoded).commit()
    }

    fun clearAuthSession() {
        if (authSessionFile.exists()) authSessionFile.delete()
        prefs.edit().remove("auth_session").commit()
        if (submissionsCacheFile.exists()) submissionsCacheFile.delete()
        if (certificatesCacheFile.exists()) certificatesCacheFile.delete()
    }

    // ---- Offline Cache for Submissions & Certificates ----
    fun loadCachedSubmissions(): List<CourseSubmission> {
        if (!submissionsCacheFile.exists()) return emptyList()
        return runCatching {
            json.decodeFromString<List<CourseSubmission>>(submissionsCacheFile.readText())
        }.getOrDefault(emptyList())
    }

    fun saveCachedSubmissions(list: List<CourseSubmission>) {
        submissionsCacheFile.writeText(json.encodeToString(list))
    }

    fun loadCachedCertificates(): List<CertificateRecord> {
        if (!certificatesCacheFile.exists()) return emptyList()
        return runCatching {
            json.decodeFromString<List<CertificateRecord>>(certificatesCacheFile.readText())
        }.getOrDefault(emptyList())
    }

    fun saveCachedCertificates(list: List<CertificateRecord>) {
        certificatesCacheFile.writeText(json.encodeToString(list))
    }

    // ---- Courses & Media ----
    suspend fun downloadCourse(
        course: Course,
        serverBaseUrl: String,
        onProgress: (Int) -> Unit,
    ): DownloadedCoursePackage = withContext(Dispatchers.IO) {
        val urls = buildSet {
            if (course.bannerUrl.isNotBlank()) add(course.bannerUrl)
            course.modules.filter { it.kind == "lesson" }.forEach { lesson ->
                lesson.blocks.forEach { blk ->
                    if ((blk.type == "image" || blk.type == "video") && !blk.url.isNullOrBlank()) {
                        add(blk.url)
                    }
                }
            }
        }.toList()

        val localMap = mutableMapOf<String, String>()
        var totalBytes = json.encodeToString(course).toByteArray().size.toLong()
        val steps = maxOf(1, urls.size)

        val normalizedBase = ApiClient.normalizeConnectionUrl(serverBaseUrl)
        urls.forEachIndexed { idx, rawUrl ->
            val resolved = if (rawUrl.startsWith("http")) rawUrl else "$normalizedBase$rawUrl"
            runCatching {
                val req = Request.Builder().url(resolved).build()
                http.newCall(req).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val bytes = resp.body?.bytes()
                        if (bytes != null) {
                            val ext = rawUrl.substringAfterLast('.', "bin").take(5)
                            val hash = sha256(rawUrl).take(16)
                            val outFile = File(mediaDir, "${course._id}_$hash.$ext")
                            outFile.writeBytes(bytes)
                            localMap[rawUrl] = outFile.absolutePath
                            totalBytes += bytes.size
                        }
                    }
                }
            }
            onProgress(((idx + 1) * 100) / steps)
        }
        if (urls.isEmpty()) onProgress(100)

        val pkg = DownloadedCoursePackage(
            courseId = course._id,
            course = course,
            localMediaMap = localMap,
            downloadedAt = Instant.now().toString(),
            totalBytes = totalBytes,
        )

        val current = loadPackages().associateBy { it.courseId }.toMutableMap()
        current[course._id] = pkg
        packagesFile.writeText(json.encodeToString(current.values.toList()))

        val progMap = loadProgressMap().toMutableMap()
        if (!progMap.containsKey(course._id)) {
            progMap[course._id] = CourseProgressState(courseId = course._id)
            progressFile.writeText(json.encodeToString(progMap))
        }
        pkg
    }

    fun loadPackages(): List<DownloadedCoursePackage> {
        if (!packagesFile.exists()) return emptyList()
        return runCatching {
            json.decodeFromString<List<DownloadedCoursePackage>>(packagesFile.readText())
        }.getOrDefault(emptyList())
    }

    fun removeCourse(courseId: String) {
        val pkgs = loadPackages().filterNot { it.courseId == courseId }
        packagesFile.writeText(json.encodeToString(pkgs))
        val prog = loadProgressMap().toMutableMap()
        prog.remove(courseId)
        progressFile.writeText(json.encodeToString(prog))
    }

    fun loadProgressMap(): Map<String, CourseProgressState> {
        if (!progressFile.exists()) return emptyMap()
        return runCatching {
            json.decodeFromString<Map<String, CourseProgressState>>(progressFile.readText())
        }.getOrDefault(emptyMap())
    }

    fun saveProgress(state: CourseProgressState) {
        val map = loadProgressMap().toMutableMap()
        map[state.courseId] = state
        progressFile.writeText(json.encodeToString(map))
    }

    fun loadPendingSubmissions(): List<PendingOfflineSubmission> {
        if (!pendingFile.exists()) return emptyList()
        return runCatching {
            json.decodeFromString<List<PendingOfflineSubmission>>(pendingFile.readText())
        }.getOrDefault(emptyList())
    }

    fun savePendingSubmission(item: PendingOfflineSubmission) {
        val list = loadPendingSubmissions().toMutableList()
        list.add(0, item)
        pendingFile.writeText(json.encodeToString(list))
    }

    fun removePendingSubmission(id: String) {
        val list = loadPendingSubmissions().filterNot { it.id == id }
        pendingFile.writeText(json.encodeToString(list))
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
