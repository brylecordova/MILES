package com.certifield.app.data

import android.content.Context
import com.certifield.app.model.Course
import com.certifield.app.model.CourseProgressState
import com.certifield.app.model.DownloadedCoursePackage
import com.certifield.app.model.PendingOfflineSubmission
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest
import java.time.Instant

class OfflineCourseStore(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val http = OkHttpClient()

    private val rootDir: File = File(context.filesDir, "offline_courses").apply { mkdirs() }
    private val mediaDir: File = File(rootDir, "media").apply { mkdirs() }
    private val packagesFile = File(rootDir, "packages.json")
    private val progressFile = File(rootDir, "progress.json")
    private val pendingFile = File(rootDir, "pending_submissions.json")

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

        urls.forEachIndexed { idx, rawUrl ->
            val resolved = if (rawUrl.startsWith("http")) rawUrl else "${serverBaseUrl.trimEnd('/')}$rawUrl"
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
