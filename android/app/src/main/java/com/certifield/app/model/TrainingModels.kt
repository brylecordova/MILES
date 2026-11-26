package com.certifield.app.model

import kotlinx.serialization.Serializable

@Serializable
data class LessonBlock(
    val id: String,
    val type: String, // "header" | "body" | "bullets" | "image" | "video"
    val level: Int? = null,
    val text: String? = null,
    val align: String? = null,
    val items: List<String> = emptyList(),
    val url: String? = null,
    val caption: String? = null,
)

@Serializable
data class QuizQuestion(
    val id: String,
    val type: String, // "multiple_choice" | "true_false" | "select_all" | "essay"
    val prompt: String,
    val topicTag: String? = null,
    val options: List<String> = emptyList(),
    val correctIndex: Int? = null,
    val correctIndices: List<Int> = emptyList(),
    val modelAnswer: String? = null,
    val essayRubricKeywords: List<String> = emptyList(),
    val explanation: String = "",
)

@Serializable
data class CourseModule(
    val id: String,
    val kind: String, // "lesson" | "quiz"
    val title: String,
    val estimatedMinutes: Int? = null,
    val blocks: List<LessonBlock> = emptyList(),
    val description: String? = null,
    val passingScore: Int? = null,
    val failureRule: String? = null, // "retry_quiz" | "restart_since_last_quiz" | "restart_course"
    val passingRule: String? = null, // "proceed_next" | "require_manual_review"
    val questions: List<QuizQuestion> = emptyList(),
)

@Serializable
data class CertificateElement(
    val id: String,
    val kind: String,
    val label: String = "",
    val text: String = "",
    val xPct: Float = 50f,
    val yPct: Float = 50f,
    val fontSize: Float = 14f,
    val fontWeight: String = "normal",
    val fontFamily: String = "sans",
    val color: String = "#0f172a",
    val align: String = "center",
    val visible: Boolean = true,
)

@Serializable
data class CertificateDesign(
    val canvasBackground: String = "#ffffff",
    val backgroundImageUrl: String? = null,
    val borderColor: String = "#0f172a",
    val accentColor: String = "#1d4ed8",
    val showBorder: Boolean = true,
    val elements: List<CertificateElement> = emptyList(),
)

@Serializable
data class Course(
    val _id: String,
    val title: String,
    val description: String,
    val category: String,
    val bannerUrl: String = "",
    val certificateTitle: String = "",
    val issuerName: String = "CertiField Academy",
    val published: Boolean = true,
    val modules: List<CourseModule> = emptyList(),
    val certificateDesign: CertificateDesign? = null,
    val createdAt: String = "",
    val updatedAt: String = "",
)

@Serializable
data class UserAccount(
    val _id: String,
    val name: String,
    val email: String,
    val role: String,
    val createdAt: String = "",
)

@Serializable
data class QuestionAttemptRecord(
    val questionId: String,
    val quizId: String,
    val quizTitle: String,
    val questionPrompt: String,
    val questionType: String,
    val topicTag: String,
    val tries: Int,
    val userAnswerLabel: String,
    val correctAnswerLabel: String,
    val isCorrect: Boolean,
    val needsManualReview: Boolean = false,
    val explanation: String = "",
)

@Serializable
data class QuizAttemptSummary(
    val quizId: String,
    val quizTitle: String,
    val score: Int,
    val passingScore: Int,
    val passed: Boolean,
    val attempts: Int,
)

@Serializable
data class CourseSubmission(
    val _id: String,
    val courseId: String,
    val courseTitle: String,
    val certificateTitle: String,
    val issuerName: String,
    val userId: String,
    val userName: String,
    val userEmail: String,
    val overallScore: Int,
    val passed: Boolean,
    val status: String, // "pending_review" | "approved" | "rejected"
    val adminFeedback: String? = null,
    val reviewedAt: String? = null,
    val submittedAt: String,
    val completedOfflineAt: String? = null,
    val readingDurationSeconds: Int = 0,
    val questionResults: List<QuestionAttemptRecord> = emptyList(),
    val quizResults: List<QuizAttemptSummary> = emptyList(),
    val certificateId: String? = null,
)

@Serializable
data class CertificateRecord(
    val _id: String,
    val certificateCode: String,
    val submissionId: String,
    val courseId: String,
    val courseTitle: String,
    val certificateTitle: String,
    val issuerName: String,
    val userId: String,
    val userName: String,
    val userEmail: String,
    val score: Int,
    val issuedAt: String,
    val emailedCount: Int = 0,
    val certificateDesign: CertificateDesign? = null,
    val systemIconUrl: String? = null,
)

@Serializable
data class CourseProgressState(
    val courseId: String,
    val currentModuleIndex: Int = 0,
    val completedModuleIds: List<String> = emptyList(),
    val questionTries: Map<String, Int> = emptyMap(),
    val quizAttempts: Map<String, Int> = emptyMap(),
    val latestQuestionResults: Map<String, QuestionAttemptRecord> = emptyMap(),
    val quizResults: Map<String, QuizAttemptSummary> = emptyMap(),
    val readingDurationSeconds: Int = 0,
    val status: String = "not_started", // "not_started" | "in_progress" | "completed"
    val updatedAt: String = "",
)

@Serializable
data class DownloadedCoursePackage(
    val courseId: String,
    val course: Course,
    val localMediaMap: Map<String, String> = emptyMap(),
    val downloadedAt: String,
    val totalBytes: Long = 0L,
)

@Serializable
data class PendingOfflineSubmission(
    val id: String,
    val courseId: String,
    val courseTitle: String,
    val certificateTitle: String,
    val issuerName: String,
    val overallScore: Int,
    val passed: Boolean,
    val completedOfflineAt: String,
    val readingDurationSeconds: Int = 0,
    val questionResults: List<QuestionAttemptRecord>,
    val quizResults: List<QuizAttemptSummary>,
)

@Serializable
data class SystemBranding(
    val systemName: String = "CertiField",
    val tagline: String = "Offline-ready Android field training and verifiable PDF certification.",
    val iconUrl: String = "/icon.svg",
    val accentColor: String = "#1d4ed8",
    val updatedAt: String = "",
)

@Serializable
data class SavedAuthSession(
    val token: String,
    val user: UserAccount,
    val serverUrl: String = "",
    val savedAt: String = "",
)

