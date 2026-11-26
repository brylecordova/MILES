package com.certifield.app.data

import com.certifield.app.model.CertificateRecord
import com.certifield.app.model.Course
import com.certifield.app.model.CourseSubmission
import com.certifield.app.model.QuestionAttemptRecord
import com.certifield.app.model.QuizAttemptSummary
import com.certifield.app.model.SystemBranding
import com.certifield.app.model.UserAccount
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

@Serializable
data class AuthResponse(val token: String, val user: UserAccount)

@Serializable
private data class BrandingResponse(val branding: SystemBranding)

@Serializable
private data class CoursesResponse(val courses: List<Course>)

@Serializable
private data class SubmissionsResponse(val submissions: List<CourseSubmission>)

@Serializable
private data class CertificatesResponse(val certificates: List<CertificateRecord>)

@Serializable
private data class ErrorResponse(val error: String? = null)

@Serializable
private data class SubmitPayload(
    val courseId: String,
    val courseTitle: String,
    val certificateTitle: String,
    val issuerName: String,
    val overallScore: Int,
    val passed: Boolean,
    val completedOfflineAt: String? = null,
    val readingDurationSeconds: Int = 0,
    val questionResults: List<QuestionAttemptRecord>,
    val quizResults: List<QuizAttemptSummary>,
)

class ApiClient(private val baseUrlProvider: () -> String) {
    private val json = Json { ignoreUnknownKeys = true }
    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    @Volatile
    var token: String? = null

    private fun url(path: String): String = "${normalizeConnectionUrl(baseUrlProvider())}$path"

    companion object {
        fun normalizeConnectionUrl(raw: String): String {
            val trimmed = raw.trim().trimEnd('/')
            if (trimmed.isEmpty()) return ""
            if (trimmed.startsWith("http://", ignoreCase = true) ||
                trimmed.startsWith("https://", ignoreCase = true)
            ) {
                return trimmed
            }
            val isLocalOrIp = trimmed.startsWith("localhost", ignoreCase = true) ||
                trimmed.startsWith("127.") ||
                trimmed.startsWith("10.") ||
                trimmed.startsWith("192.168.") ||
                Regex("^172\\.(1[6-9]|2\\d|3[01])\\.").containsMatchIn(trimmed) ||
                Regex("^\\d+\\.\\d+\\.\\d+\\.\\d+").containsMatchIn(trimmed)
            return if (isLocalOrIp) "http://$trimmed" else "https://$trimmed"
        }
    }

    suspend fun checkHealth(): Boolean = withContext(Dispatchers.IO) {
        val base = normalizeConnectionUrl(baseUrlProvider())
        if (base.isEmpty()) return@withContext false
        runCatching {
            val req = Request.Builder().url("$base/api/health").build()
            http.newCall(req).execute().use { it.isSuccessful }
        }.getOrDefault(false)
    }

    suspend fun fetchBranding(overrideBaseUrl: String? = null): SystemBranding = withContext(Dispatchers.IO) {
        val base = normalizeConnectionUrl(overrideBaseUrl ?: baseUrlProvider())
        val req = Request.Builder().url("$base/api/system/branding").build()
        execute<BrandingResponse>(req).branding
    }

    suspend fun register(name: String, email: String, password: String): AuthResponse =
        postJson("/api/auth/register", mapOf("name" to name, "email" to email, "password" to password))

    suspend fun login(email: String, password: String): AuthResponse =
        postJson("/api/auth/login", mapOf("email" to email, "password" to password))

    suspend fun fetchCourses(): List<Course> = withContext(Dispatchers.IO) {
        val req = Request.Builder().url(url("/api/courses")).build()
        execute<CoursesResponse>(req).courses
    }

    suspend fun trackCourseDownload(courseId: String) = withContext(Dispatchers.IO) {
        runCatching {
            val emptyBody = "{}".toRequestBody(jsonMedia)
            val req = Request.Builder()
                .url(url("/api/courses/$courseId/track-download"))
                .apply { token?.let { header("Authorization", "Bearer $it") } }
                .post(emptyBody)
                .build()
            http.newCall(req).execute().close()
        }
    }

    suspend fun submitCourse(
        courseId: String,
        courseTitle: String,
        certificateTitle: String,
        issuerName: String,
        overallScore: Int,
        passed: Boolean,
        completedOfflineAt: String?,
        readingDurationSeconds: Int = 0,
        questionResults: List<QuestionAttemptRecord>,
        quizResults: List<QuizAttemptSummary>,
    ) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(
            SubmitPayload(
                courseId = courseId,
                courseTitle = courseTitle,
                certificateTitle = certificateTitle,
                issuerName = issuerName,
                overallScore = overallScore,
                passed = passed,
                completedOfflineAt = completedOfflineAt,
                readingDurationSeconds = readingDurationSeconds,
                questionResults = questionResults,
                quizResults = quizResults,
            )
        ).toRequestBody(jsonMedia)
        val req = Request.Builder()
            .url(url("/api/submissions"))
            .apply { token?.let { header("Authorization", "Bearer $it") } }
            .post(body)
            .build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) {
                val msg = runCatching { json.decodeFromString<ErrorResponse>(resp.body?.string().orEmpty()).error }.getOrNull()
                throw IllegalStateException(msg ?: "Submission failed (${resp.code})")
            }
        }
    }

    suspend fun fetchMySubmissions(): List<CourseSubmission> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url(url("/api/submissions/mine"))
            .apply { token?.let { header("Authorization", "Bearer $it") } }
            .build()
        execute<SubmissionsResponse>(req).submissions
    }

    suspend fun fetchMyCertificates(): List<CertificateRecord> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url(url("/api/certificates/mine"))
            .apply { token?.let { header("Authorization", "Bearer $it") } }
            .build()
        execute<CertificatesResponse>(req).certificates
    }

    private suspend inline fun <reified T> postJson(path: String, payload: Map<String, String>): T =
        withContext(Dispatchers.IO) {
            val body = json.encodeToString(payload).toRequestBody(jsonMedia)
            val req = Request.Builder().url(url(path)).post(body).build()
            execute<T>(req)
        }

    private inline fun <reified T> execute(req: Request): T {
        http.newCall(req).execute().use { resp ->
            val raw = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val msg = runCatching { json.decodeFromString<ErrorResponse>(raw).error }.getOrNull()
                throw IllegalStateException(msg ?: "Request failed (${resp.code})")
            }
            return json.decodeFromString<T>(raw)
        }
    }
}
