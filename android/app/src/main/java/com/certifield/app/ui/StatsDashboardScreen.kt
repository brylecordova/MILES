package com.certifield.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.certifield.app.model.*
import kotlin.math.max
import kotlin.math.roundToInt

data class LearnerMedal(
    val id: String,
    val title: String,
    val tier: String, // "gold" | "silver" | "bronze"
    val description: String,
    val earned: Boolean,
)

data class CourseStatRow(
    val courseId: String,
    val courseTitle: String,
    val readingSeconds: Int,
    val avgQuizRetries: Double,
    val score: Int,
    val completionPct: Int,
    val statusLabel: String,
)

data class LearnerDashboardSummary(
    val downloadedCount: Int,
    val completedCount: Int,
    val certifiedCount: Int,
    val avgScore: Int,
    val avgReadingSeconds: Int,
    val totalReadingSeconds: Int,
    val avgQuizRetries: Double,
    val capacityScore: Int,
    val capacityTier: String,
    val medals: List<LearnerMedal>,
    val courseRows: List<CourseStatRow>,
)

object LearnerStatsCalculator {

    fun formatDuration(seconds: Int): String {
        val safe = max(0, seconds)
        if (safe < 60) return "${safe}s"
        val mins = safe / 60
        val remSecs = safe % 60
        if (mins < 60) return if (remSecs > 0) "${mins}m ${remSecs}s" else "${mins}m"
        val hrs = mins / 60
        val remMins = mins % 60
        return if (remMins > 0) "${hrs}h ${remMins}m" else "${hrs}h"
    }

    fun compute(
        downloadedPackages: List<DownloadedCoursePackage>,
        progressMap: Map<String, CourseProgressState>,
        pendingSubmissions: List<PendingOfflineSubmission>,
        submittedCourses: List<CourseSubmission>,
        certificates: List<CertificateRecord>,
    ): LearnerDashboardSummary {
        val latestSubByCourse = mutableMapOf<String, CourseSubmission>()
        submittedCourses.forEach { sub ->
            if (!latestSubByCourse.containsKey(sub.courseId)) {
                latestSubByCourse[sub.courseId] = sub
            }
        }
        val latestPendingByCourse = mutableMapOf<String, PendingOfflineSubmission>()
        pendingSubmissions.forEach { p ->
            if (!latestPendingByCourse.containsKey(p.courseId)) {
                latestPendingByCourse[p.courseId] = p
            }
        }

        val allCourseIds = linkedSetOf<String>()
        downloadedPackages.forEach { allCourseIds += it.courseId }
        progressMap.keys.forEach { allCourseIds += it }
        submittedCourses.forEach { allCourseIds += it.courseId }
        pendingSubmissions.forEach { allCourseIds += it.courseId }

        val pkgMap = downloadedPackages.associateBy { it.courseId }
        val rows = allCourseIds.map { cid ->
            val pkg = pkgMap[cid]
            val prog = progressMap[cid]
            val sub = latestSubByCourse[cid]
            val pend = latestPendingByCourse[cid]

            val title = pkg?.course?.title ?: sub?.courseTitle ?: pend?.courseTitle ?: "Training Course"
            val totalModules = max(1, pkg?.course?.modules?.size ?: 1)
            val doneModules = prog?.completedModuleIds?.size ?: if (sub != null || pend != null) totalModules else 0
            val completionPct = if (sub != null || pend != null || prog?.status == "completed") 100
            else ((doneModules.toDouble() / totalModules) * 100.0).roundToInt().coerceIn(0, 100)

            val readingSecs = maxOf(
                prog?.readingDurationSeconds ?: 0,
                sub?.readingDurationSeconds ?: 0,
                pend?.readingDurationSeconds ?: 0,
            )

            val questionList = sub?.questionResults?.ifEmpty { null }
                ?: pend?.questionResults?.ifEmpty { null }
                ?: prog?.latestQuestionResults?.values?.toList().orEmpty()
            val quizSummaries = sub?.quizResults?.ifEmpty { null }
                ?: pend?.quizResults?.ifEmpty { null }
                ?: prog?.quizResults?.values?.toList().orEmpty()

            val retries = when {
                questionList.isNotEmpty() -> questionList.map { max(1, it.tries).toDouble() }.average()
                quizSummaries.isNotEmpty() -> quizSummaries.map { max(1, it.attempts).toDouble() }.average()
                else -> 0.0
            }

            val score = sub?.overallScore
                ?: pend?.overallScore
                ?: if (quizSummaries.isNotEmpty()) quizSummaries.map { it.score }.average().roundToInt() else 0

            val statusLabel = when {
                sub?.status == "approved" -> "Certified"
                sub?.status == "pending_review" -> "In Review"
                pend != null -> "Queued"
                prog?.status == "completed" -> "Completed"
                doneModules > 0 -> "In Progress"
                else -> "Downloaded"
            }

            CourseStatRow(
                courseId = cid,
                courseTitle = title,
                readingSeconds = readingSecs,
                avgQuizRetries = (retries * 10.0).roundToInt() / 10.0,
                score = score,
                completionPct = completionPct,
                statusLabel = statusLabel,
            )
        }

        val scoredRows = rows.filter { it.score > 0 }
        val avgScore = if (scoredRows.isEmpty()) 0 else scoredRows.map { it.score }.average().roundToInt()
        val readingRows = rows.filter { it.readingSeconds > 0 }
        val totalReadingSeconds = rows.sumOf { it.readingSeconds }
        val avgReadingSeconds = if (readingRows.isEmpty()) 0 else (totalReadingSeconds.toDouble() / readingRows.size).roundToInt()
        val retryRows = rows.filter { it.avgQuizRetries > 0.0 }
        val avgQuizRetries = if (retryRows.isEmpty()) 1.0
        else (retryRows.map { it.avgQuizRetries }.average() * 10.0).roundToInt() / 10.0

        val completedCourseIds = (submittedCourses.filter { it.passed }.map { it.courseId } +
            pendingSubmissions.filter { it.passed }.map { it.courseId } +
            progressMap.values.filter { it.status == "completed" }.map { it.courseId }).toSet()

        val retryEfficiency = (100.0 - (avgQuizRetries - 1.0) * 28.0).coerceIn(25.0, 100.0)
        val completionPctAll = if (rows.isEmpty()) 0.0 else (completedCourseIds.size.toDouble() / rows.size) * 100.0
        val capacityScore = if (scoredRows.isEmpty() && completedCourseIds.isEmpty()) 0
        else (avgScore * 0.52 + retryEfficiency * 0.28 + completionPctAll * 0.20).roundToInt().coerceIn(0, 100)

        val capacityTier = when {
            capacityScore >= 82 -> "Accelerated"
            capacityScore >= 60 -> "Steady"
            else -> "Building Momentum"
        }

        val hasFirstTryAce = scoredRows.isNotEmpty() && retryRows.any { it.avgQuizRetries <= 1.2 } && avgScore >= 85
        val medals = listOf(
            LearnerMedal(
                id = "first_steps",
                title = "First Steps",
                tier = "bronze",
                description = "Download an offline course pack.",
                earned = downloadedPackages.isNotEmpty() || rows.isNotEmpty(),
            ),
            LearnerMedal(
                id = "field_ready",
                title = "Field Ready",
                tier = "silver",
                description = "Complete a full course & assessment.",
                earned = completedCourseIds.isNotEmpty(),
            ),
            LearnerMedal(
                id = "deep_reader",
                title = "Deep Reader",
                tier = "bronze",
                description = "Log at least 3 minutes reading lessons.",
                earned = totalReadingSeconds >= 180,
            ),
            LearnerMedal(
                id = "sharp_shot",
                title = "Sharp Shot",
                tier = "silver",
                description = "Score 85%+ with <= 1.2 average quiz tries.",
                earned = hasFirstTryAce,
            ),
            LearnerMedal(
                id = "honor_roll",
                title = "Honor Roll",
                tier = "gold",
                description = "Maintain 90%+ average assessment score.",
                earned = avgScore >= 90,
            ),
            LearnerMedal(
                id = "multi_certified",
                title = "Multi-Certified",
                tier = "gold",
                description = "Earn 2 or more approved certificates.",
                earned = certificates.size >= 2,
            ),
        )

        return LearnerDashboardSummary(
            downloadedCount = downloadedPackages.size,
            completedCount = completedCourseIds.size,
            certifiedCount = certificates.size,
            avgScore = avgScore,
            avgReadingSeconds = avgReadingSeconds,
            totalReadingSeconds = totalReadingSeconds,
            avgQuizRetries = avgQuizRetries,
            capacityScore = capacityScore,
            capacityTier = capacityTier,
            medals = medals,
            courseRows = rows,
        )
    }
}

@Composable
fun StatsDashboardScreen(
    downloadedPackages: List<DownloadedCoursePackage>,
    progressMap: Map<String, CourseProgressState>,
    pendingSubmissions: List<PendingOfflineSubmission>,
    submittedCourses: List<CourseSubmission>,
    certificates: List<CertificateRecord>,
) {
    val summary = remember(downloadedPackages, progressMap, pendingSubmissions, submittedCourses, certificates) {
        LearnerStatsCalculator.compute(
            downloadedPackages = downloadedPackages,
            progressMap = progressMap,
            pendingSubmissions = pendingSubmissions,
            submittedCourses = submittedCourses,
            certificates = certificates,
        )
    }
    val earnedCount = summary.medals.count { it.earned }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(vertical = 12.dp),
    ) {
        item {
            Column {
                Text(
                    "Learner Statistics",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A),
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    "Average performance metrics, reading time, score trends, and earned medals.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF475569),
                )
            }
        }

        // 2x2 KPI Averages Grid
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    StatKpiCard(
                        label = "AVG QUIZ SCORE",
                        value = "${summary.avgScore}%",
                        hint = "${summary.completedCount} completed · ${summary.certifiedCount} certified",
                        accent = Color(0xFF1D4ED8),
                        modifier = Modifier.weight(1f),
                    )
                    StatKpiCard(
                        label = "AVG READING TIME",
                        value = LearnerStatsCalculator.formatDuration(summary.avgReadingSeconds),
                        hint = "Total ${LearnerStatsCalculator.formatDuration(summary.totalReadingSeconds)}",
                        accent = Color(0xFF0F172A),
                        modifier = Modifier.weight(1f),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    StatKpiCard(
                        label = "AVG QUIZ RETRIES",
                        value = "${summary.avgQuizRetries}x",
                        hint = if (summary.avgQuizRetries <= 1.3) "First-try mastery" else "Review highlights",
                        accent = Color(0xFFD97706),
                        modifier = Modifier.weight(1f),
                    )
                    StatKpiCard(
                        label = "LEARNING CAPACITY",
                        value = "${summary.capacityScore}/100",
                        hint = summary.capacityTier,
                        accent = Color(0xFF15803D),
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        // Score & Completion Canvas Chart
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Course Score & Progress Chart",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A),
                        )
                        Text(
                            "Blue: Score · Slate: Progress",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF64748B),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    if (summary.courseRows.isEmpty()) {
                        Text(
                            "Download and start a course to populate your performance chart.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF64748B),
                        )
                    } else {
                        CourseBarChart(rows = summary.courseRows.take(5))
                    }
                }
            }
        }

        // Medals Grid
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.EmojiEvents,
                                contentDescription = null,
                                tint = Color(0xFFD97706),
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Medals & Milestones",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF0F172A),
                            )
                        }
                        Text(
                            "$earnedCount / ${summary.medals.size} unlocked",
                            style = MaterialTheme.typography.labelMedium,
                            fontFamily = FontFamily.Monospace,
                            color = Color(0xFF1D4ED8),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        summary.medals.chunked(2).forEach { pair ->
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                pair.forEach { medal ->
                                    MedalCard(medal = medal, modifier = Modifier.weight(1f))
                                }
                                if (pair.size == 1) {
                                    Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }
        }

        // Course Performance Table
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "Course Breakdown Table",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A),
                    )
                    Spacer(Modifier.height(10.dp))
                    if (summary.courseRows.isEmpty()) {
                        Text(
                            "No course records yet.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF64748B),
                        )
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
                                .clip(RoundedCornerShape(10.dp)),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFFF8FAFC))
                                    .padding(horizontal = 10.dp, vertical = 8.dp),
                            ) {
                                Text(
                                    "Course",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF475569),
                                    modifier = Modifier.weight(2.2f),
                                )
                                Text(
                                    "Read",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF475569),
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    "Tries",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF475569),
                                    modifier = Modifier.weight(0.9f),
                                )
                                Text(
                                    "Score",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF475569),
                                    modifier = Modifier.weight(0.9f),
                                )
                            }
                            summary.courseRows.forEach { row ->
                                HorizontalDivider(color = Color(0xFFE2E8F0))
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 10.dp, vertical = 10.dp),
                                ) {
                                    Column(Modifier.weight(2.2f).padding(end = 6.dp)) {
                                        Text(
                                            row.courseTitle,
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            color = Color(0xFF0F172A),
                                        )
                                        Text(
                                            row.statusLabel,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color(0xFF64748B),
                                        )
                                    }
                                    Text(
                                        LearnerStatsCalculator.formatDuration(row.readingSeconds),
                                        style = MaterialTheme.typography.labelMedium,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFF334155),
                                        modifier = Modifier.weight(1f),
                                    )
                                    Text(
                                        if (row.avgQuizRetries > 0) "${row.avgQuizRetries}x" else "-",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFF334155),
                                        modifier = Modifier.weight(0.9f),
                                    )
                                    Text(
                                        if (row.score > 0) "${row.score}%" else "${row.completionPct}%",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF1D4ED8),
                                        modifier = Modifier.weight(0.9f),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatKpiCard(
    label: String,
    value: String,
    hint: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF64748B),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                value,
                style = MaterialTheme.typography.headlineSmall,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = accent,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                hint,
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF475569),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun CourseBarChart(rows: List<CourseStatRow>) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { row ->
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        row.courseTitle,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0F172A),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f).padding(end = 8.dp),
                    )
                    Text(
                        "${row.score}% score · ${row.completionPct}% done",
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace,
                        color = Color(0xFF475569),
                    )
                }
                Spacer(Modifier.height(4.dp))
                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(14.dp),
                ) {
                    val barHeight = size.height / 2f - 1.dp.toPx()
                    // Track
                    drawRoundRect(
                        color = Color(0xFFF1F5F9),
                        topLeft = Offset.Zero,
                        size = Size(size.width, barHeight),
                        cornerRadius = CornerRadius(4f, 4f),
                    )
                    // Score bar
                    val scoreWidth = (size.width * (row.score.coerceIn(0, 100) / 100f))
                    drawRoundRect(
                        color = Color(0xFF1D4ED8),
                        topLeft = Offset.Zero,
                        size = Size(scoreWidth, barHeight),
                        cornerRadius = CornerRadius(4f, 4f),
                    )
                    // Completion track
                    val secondTop = barHeight + 2.dp.toPx()
                    drawRoundRect(
                        color = Color(0xFFF1F5F9),
                        topLeft = Offset(0f, secondTop),
                        size = Size(size.width, barHeight),
                        cornerRadius = CornerRadius(4f, 4f),
                    )
                    val compWidth = (size.width * (row.completionPct.coerceIn(0, 100) / 100f))
                    drawRoundRect(
                        color = Color(0xFF0F172A),
                        topLeft = Offset(0f, secondTop),
                        size = Size(compWidth, barHeight),
                        cornerRadius = CornerRadius(4f, 4f),
                    )
                }
            }
        }
    }
}

@Composable
private fun MedalCard(
    medal: LearnerMedal,
    modifier: Modifier = Modifier,
) {
    val tierColor = when {
        !medal.earned -> Color(0xFF94A3B8)
        medal.tier == "gold" -> Color(0xFFD97706)
        medal.tier == "silver" -> Color(0xFF475569)
        else -> Color(0xFFB45309)
    }
    val bgColor = if (medal.earned) Color(0xFFFFFBEB) else Color(0xFFF8FAFC)
    val borderColor = if (medal.earned) Color(0xFFFDE68A) else Color(0xFFE2E8F0)

    Surface(
        modifier = modifier,
        color = bgColor,
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(if (medal.earned) tierColor.copy(alpha = 0.16f) else Color(0xFFE2E8F0)),
                ) {
                    Icon(
                        if (medal.earned) Icons.Default.WorkspacePremium else Icons.Default.Lock,
                        contentDescription = null,
                        tint = tierColor,
                        modifier = Modifier.size(15.dp),
                    )
                }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        medal.title,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (medal.earned) Color(0xFF0F172A) else Color(0xFF64748B),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        if (medal.earned) medal.tier.uppercase() else "LOCKED",
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace,
                        color = tierColor,
                    )
                }
            }
            Spacer(Modifier.height(6.dp))
            Text(
                medal.description,
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF475569),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
