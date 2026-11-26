package com.certifield.app.ui

import android.net.Uri
import android.view.ViewGroup
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.certifield.app.BuildConfig
import com.certifield.app.data.ApiClient
import com.certifield.app.data.OfflineCourseStore
import com.certifield.app.data.QuizAnswerInput
import com.certifield.app.data.QuizEngine
import com.certifield.app.model.*
import com.certifield.app.pdf.CertificatePdfHelper
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant

enum class LearnerTab(val label: String) {
    AVAILABLE("Available"),
    DOWNLOADED("Downloaded"),
    FINISHED("Finished"),
    CERTIFICATES("Certificates"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CertiFieldApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val store = remember { OfflineCourseStore(context) }
    var serverUrl by remember { mutableStateOf(BuildConfig.DEFAULT_SERVER_URL) }
    val api = remember { ApiClient { serverUrl } }

    var activeTab by remember { mutableStateOf(LearnerTab.AVAILABLE) }
    var user by remember { mutableStateOf<UserAccount?>(null) }
    var showAuthDialog by remember { mutableStateOf(false) }
    var showServerDialog by remember { mutableStateOf(false) }
    var isOfflineMode by remember { mutableStateOf(false) }

    var courses by remember { mutableStateOf<List<Course>>(emptyList()) }
    var downloadedPackages by remember { mutableStateOf(store.loadPackages()) }
    var progressMap by remember { mutableStateOf(store.loadProgressMap()) }
    var pendingSubmissions by remember { mutableStateOf(store.loadPendingSubmissions()) }
    var submittedCourses by remember { mutableStateOf<List<CourseSubmission>>(emptyList()) }
    var certificates by remember { mutableStateOf<List<CertificateRecord>>(emptyList()) }
    var downloadPct by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var activePlayerPkg by remember { mutableStateOf<DownloadedCoursePackage?>(null) }
    var bannerMessage by remember { mutableStateOf<String?>(null) }

    fun refreshLocal() {
        downloadedPackages = store.loadPackages()
        progressMap = store.loadProgressMap()
        pendingSubmissions = store.loadPendingSubmissions()
    }

    suspend fun refreshRemote() {
        if (isOfflineMode) return
        runCatching { courses = api.fetchCourses() }
            .onFailure { bannerMessage = "Offline or unreachable server; downloaded courses remain available." }
        if (user != null) {
            runCatching { submittedCourses = api.fetchMySubmissions() }
            runCatching { certificates = api.fetchMyCertificates() }
        }
    }

    LaunchedEffect(serverUrl, user, isOfflineMode) {
        refreshRemote()
    }

    if (activePlayerPkg != null) {
        val pkg = activePlayerPkg!!
        CoursePlayerScreen(
            pkg = pkg,
            serverUrl = serverUrl,
            initialProgress = progressMap[pkg.courseId] ?: CourseProgressState(courseId = pkg.courseId),
            isOffline = isOfflineMode,
            user = user,
            onProgressChange = { next ->
                store.saveProgress(next)
                refreshLocal()
            },
            onSubmitOnline = { score, passed, qRes, quizRes ->
                api.submitCourse(
                    courseId = pkg.course._id,
                    courseTitle = pkg.course.title,
                    certificateTitle = pkg.course.certificateTitle,
                    issuerName = pkg.course.issuerName,
                    overallScore = score,
                    passed = passed,
                    completedOfflineAt = null,
                    questionResults = qRes,
                    quizResults = quizRes,
                )
                refreshRemote()
                activePlayerPkg = null
                activeTab = LearnerTab.FINISHED
            },
            onSavePendingOffline = { item ->
                store.savePendingSubmission(item)
                refreshLocal()
                activePlayerPkg = null
                activeTab = LearnerTab.FINISHED
            },
            onRequireAuth = { showAuthDialog = true },
            onExit = {
                activePlayerPkg = null
                refreshLocal()
            },
        )
        return
    }

    Scaffold(
        containerColor = Color(0xFFF8FAFC),
        topBar = {
            TopAppBar(
                title = {
                    Text("CertiField", fontWeight = FontWeight.ExtraBold)
                },
                actions = {
                    TextButton(onClick = { isOfflineMode = !isOfflineMode }) {
                        Icon(
                            if (isOfflineMode) Icons.Default.WifiOff else Icons.Default.Wifi,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(if (isOfflineMode) "Offline" else "Online")
                    }
                    IconButton(onClick = { showServerDialog = true }) {
                        Icon(Icons.Default.Dns, contentDescription = "Server URL")
                    }
                    TextButton(onClick = { showAuthDialog = true }) {
                        Text(user?.name?.split(" ")?.firstOrNull() ?: "Sign In")
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                LearnerTab.entries.forEach { tab ->
                    val icon = when (tab) {
                        LearnerTab.AVAILABLE -> Icons.Default.MenuBook
                        LearnerTab.DOWNLOADED -> Icons.Default.DownloadDone
                        LearnerTab.FINISHED -> Icons.Default.FactCheck
                        LearnerTab.CERTIFICATES -> Icons.Default.WorkspacePremium
                    }
                    NavigationBarItem(
                        selected = activeTab == tab,
                        onClick = {
                            activeTab = tab
                            scope.launch { refreshRemote() }
                        },
                        icon = { Icon(icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
        ) {
            bannerMessage?.let { msg ->
                Surface(
                    color = Color(0xFFFEF3C7),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                ) {
                    Text(
                        text = msg,
                        color = Color(0xFF92400E),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            when (activeTab) {
                LearnerTab.AVAILABLE -> AvailableCoursesTab(
                    courses = courses,
                    serverUrl = serverUrl,
                    downloadedIds = downloadedPackages.map { it.courseId }.toSet(),
                    downloadPct = downloadPct,
                    isOffline = isOfflineMode,
                    onDownload = { course ->
                        if (user == null) {
                            showAuthDialog = true
                            return@AvailableCoursesTab
                        }
                        scope.launch {
                            downloadPct = downloadPct + (course._id to 5)
                            store.downloadCourse(course, serverUrl) { pct ->
                                downloadPct = downloadPct + (course._id to pct)
                            }
                            downloadPct = downloadPct - course._id
                            refreshLocal()
                        }
                    },
                    onOpen = { courseId ->
                        activePlayerPkg = downloadedPackages.firstOrNull { it.courseId == courseId }
                    },
                )

                LearnerTab.DOWNLOADED -> DownloadedCoursesTab(
                    packages = downloadedPackages,
                    progressMap = progressMap,
                    onOpen = { pkg -> activePlayerPkg = pkg },
                    onRemove = { courseId ->
                        store.removeCourse(courseId)
                        refreshLocal()
                    },
                )

                LearnerTab.FINISHED -> FinishedCoursesTab(
                    pending = pendingSubmissions,
                    submitted = submittedCourses,
                    isOffline = isOfflineMode,
                    user = user,
                    onSubmitPending = { item ->
                        if (user == null) {
                            showAuthDialog = true
                            return@FinishedCoursesTab
                        }
                        scope.launch {
                            runCatching {
                                api.submitCourse(
                                    courseId = item.courseId,
                                    courseTitle = item.courseTitle,
                                    certificateTitle = item.certificateTitle,
                                    issuerName = item.issuerName,
                                    overallScore = item.overallScore,
                                    passed = item.passed,
                                    completedOfflineAt = item.completedOfflineAt,
                                    questionResults = item.questionResults,
                                    quizResults = item.quizResults,
                                )
                                store.removePendingSubmission(item.id)
                                refreshLocal()
                                refreshRemote()
                            }.onFailure { bannerMessage = it.message }
                        }
                    },
                    onRequireAuth = { showAuthDialog = true },
                )

                LearnerTab.CERTIFICATES -> CertificatesTab(
                    certificates = certificates,
                    user = user,
                    onViewPdf = { cert -> CertificatePdfHelper.openPdf(context, cert) },
                    onEmailPdf = { cert -> CertificatePdfHelper.emailPdf(context, cert) },
                    onRequireAuth = { showAuthDialog = true },
                )
            }
        }
    }

    if (showAuthDialog) {
        AuthDialog(
            api = api,
            currentUser = user,
            onDismiss = { showAuthDialog = false },
            onAuthenticated = { token, account ->
                api.token = token
                user = account
                showAuthDialog = false
                scope.launch { refreshRemote() }
            },
            onSignOut = {
                api.token = null
                user = null
                submittedCourses = emptyList()
                certificates = emptyList()
                showAuthDialog = false
            },
        )
    }

    if (showServerDialog) {
        var urlDraft by remember { mutableStateOf(serverUrl) }
        AlertDialog(
            onDismissRequest = { showServerDialog = false },
            title = { Text("Server Endpoint") },
            text = {
                OutlinedTextField(
                    value = urlDraft,
                    onValueChange = { urlDraft = it },
                    label = { Text("Node.js + MongoDB Server URL") },
                    singleLine = true,
                )
            },
            confirmButton = {
                Button(onClick = {
                    serverUrl = urlDraft.trim()
                    showServerDialog = false
                }) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { showServerDialog = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun AvailableCoursesTab(
    courses: List<Course>,
    serverUrl: String,
    downloadedIds: Set<String>,
    downloadPct: Map<String, Int>,
    isOffline: Boolean,
    onDownload: (Course) -> Unit,
    onOpen: (String) -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(vertical = 12.dp),
    ) {
        items(courses, key = { it._id }) { course ->
            val isDownloaded = downloadedIds.contains(course._id)
            val pct = downloadPct[course._id]
            val bannerModel = if (course.bannerUrl.startsWith("http")) course.bannerUrl
            else "${serverUrl.trimEnd('/')}${course.bannerUrl}"

            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                shape = RoundedCornerShape(16.dp),
            ) {
                Column {
                    if (course.bannerUrl.isNotBlank()) {
                        AsyncImage(
                            model = bannerModel,
                            contentDescription = course.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().height(160.dp),
                        )
                    }
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "${course.category} · ${course.modules.count { it.kind == "lesson" }} lessons · ${course.modules.count { it.kind == "quiz" }} quizzes",
                            style = MaterialTheme.typography.labelMedium,
                            color = Color(0xFF64748B),
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(course.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        Text(course.description, style = MaterialTheme.typography.bodyMedium, color = Color(0xFF475569))
                        Spacer(Modifier.height(14.dp))
                        if (isDownloaded) {
                            Button(
                                onClick = { onOpen(course._id) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF15803D)),
                                modifier = Modifier.fillMaxWidth().height(48.dp),
                            ) {
                                Text("Downloaded · Open Course")
                            }
                        } else if (pct != null) {
                            LinearProgressIndicator(
                                progress = { pct / 100f },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(4.dp))
                            Text("Downloading offline media: $pct%", style = MaterialTheme.typography.labelSmall)
                        } else {
                            Button(
                                onClick = { onDownload(course) },
                                enabled = !isOffline,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1D4ED8)),
                                modifier = Modifier.fillMaxWidth().height(48.dp),
                            ) {
                                Icon(Icons.Default.Download, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text(if (isOffline) "Reconnect to Download" else "Download for Offline")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DownloadedCoursesTab(
    packages: List<DownloadedCoursePackage>,
    progressMap: Map<String, CourseProgressState>,
    onOpen: (DownloadedCoursePackage) -> Unit,
    onRemove: (String) -> Unit,
) {
    var filter by remember { mutableStateOf("all") }
    val filtered = packages.filter { pkg ->
        val status = progressMap[pkg.courseId]?.status ?: "not_started"
        when (filter) {
            "not_started" -> status == "not_started"
            "in_progress" -> status == "in_progress" || status == "completed"
            else -> true
        }
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(vertical = 8.dp),
        ) {
            FilterChip(selected = filter == "all", onClick = { filter = "all" }, label = { Text("All") })
            FilterChip(selected = filter == "not_started", onClick = { filter = "not_started" }, label = { Text("Not Started") })
            FilterChip(selected = filter == "in_progress", onClick = { filter = "in_progress" }, label = { Text("In Progress") })
        }

        if (filtered.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No downloaded courses in this filter.", color = Color(0xFF64748B))
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(filtered, key = { it.courseId }) { pkg ->
                    val prog = progressMap[pkg.courseId]
                    val total = maxOf(1, pkg.course.modules.size)
                    val done = prog?.completedModuleIds?.size ?: 0
                    val status = prog?.status ?: "not_started"

                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                when (status) {
                                    "completed" -> "Completed"
                                    "in_progress" -> "In Progress · $done / $total modules"
                                    else -> "Not Started"
                                },
                                style = MaterialTheme.typography.labelMedium,
                                color = Color(0xFF1D4ED8),
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(pkg.course.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(8.dp))
                            LinearProgressIndicator(
                                progress = { done.toFloat() / total.toFloat() },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(12.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = { onOpen(pkg) },
                                    modifier = Modifier.weight(1f).height(46.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1D4ED8)),
                                ) {
                                    Text(if (status == "not_started") "Start Course" else "Resume")
                                }
                                OutlinedButton(
                                    onClick = { onRemove(pkg.courseId) },
                                    modifier = Modifier.height(46.dp),
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Remove")
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
private fun FinishedCoursesTab(
    pending: List<PendingOfflineSubmission>,
    submitted: List<CourseSubmission>,
    isOffline: Boolean,
    user: UserAccount?,
    onSubmitPending: (PendingOfflineSubmission) -> Unit,
    onRequireAuth: () -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(vertical = 12.dp),
    ) {
        item {
            Text("Pending Submission (Offline Queue)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        if (pending.isEmpty()) {
            item {
                Text("No offline completions waiting to sync.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
            }
        } else {
            items(pending, key = { it.id }) { item ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB)),
                    border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(item.courseTitle, fontWeight = FontWeight.Bold)
                        Text("Score: ${item.overallScore}% · Saved offline", style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(10.dp))
                        Button(
                            onClick = { onSubmitPending(item) },
                            enabled = !isOffline,
                            modifier = Modifier.fillMaxWidth().height(44.dp),
                        ) {
                            Text(if (isOffline) "Connect Wi-Fi to Submit" else "Submit Now")
                        }
                    }
                }
            }
        }

        item {
            Spacer(Modifier.height(8.dp))
            Text("Submitted Courses", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        if (user == null) {
            item {
                Button(onClick = onRequireAuth) { Text("Sign In to View Submissions") }
            }
        } else {
            items(submitted, key = { it._id }) { sub ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        val label = when (sub.status) {
                            "approved" -> "Approved"
                            "rejected" -> "Rejected"
                            else -> "Pending Admin Review"
                        }
                        Text("$label · Score ${sub.overallScore}%", style = MaterialTheme.typography.labelMedium, color = Color(0xFF1D4ED8))
                        Spacer(Modifier.height(4.dp))
                        Text(sub.courseTitle, fontWeight = FontWeight.Bold)
                        sub.adminFeedback?.let {
                            Spacer(Modifier.height(4.dp))
                            Text("Admin note: $it", style = MaterialTheme.typography.bodySmall, color = Color(0xFF475569))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CertificatesTab(
    certificates: List<CertificateRecord>,
    user: UserAccount?,
    onViewPdf: (CertificateRecord) -> Unit,
    onEmailPdf: (CertificateRecord) -> Unit,
    onRequireAuth: () -> Unit,
) {
    if (user == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Button(onClick = onRequireAuth) { Text("Sign In to View Certificates") }
        }
        return
    }
    if (certificates.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No certificates issued yet.", color = Color(0xFF64748B))
        }
        return
    }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(vertical = 12.dp),
    ) {
        items(certificates, key = { it._id }) { cert ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text("${cert.issuerName} · ${cert.certificateCode}", style = MaterialTheme.typography.labelMedium, color = Color(0xFF1D4ED8))
                    Spacer(Modifier.height(4.dp))
                    Text(cert.certificateTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("${cert.courseTitle} · Score ${cert.score}%", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { onViewPdf(cert) },
                            modifier = Modifier.weight(1f).height(46.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1D4ED8)),
                        ) {
                            Text("View PDF")
                        }
                        OutlinedButton(
                            onClick = { onEmailPdf(cert) },
                            modifier = Modifier.weight(1f).height(46.dp),
                        ) {
                            Text("Email PDF")
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CoursePlayerScreen(
    pkg: DownloadedCoursePackage,
    serverUrl: String,
    initialProgress: CourseProgressState,
    isOffline: Boolean,
    user: UserAccount?,
    onProgressChange: (CourseProgressState) -> Unit,
    onSubmitOnline: suspend (Int, Boolean, List<QuestionAttemptRecord>, List<QuizAttemptSummary>) -> Unit,
    onSavePendingOffline: (PendingOfflineSubmission) -> Unit,
    onRequireAuth: () -> Unit,
    onExit: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var progress by remember { mutableStateOf(initialProgress) }
    var showSummary by remember { mutableStateOf(initialProgress.status == "completed") }
    var answers by remember { mutableStateOf<Map<String, QuizAnswerInput>>(emptyMap()) }
    var feedbackBanner by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var restartTargetIdx by remember { mutableStateOf(0) }
    var errorText by remember { mutableStateOf<String?>(null) }

    val mod = pkg.course.modules.getOrNull(progress.currentModuleIndex)

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onExit) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Exit")
                    }
                },
                title = {
                    Text(
                        if (showSummary) "Course Summary" else mod?.title ?: pkg.course.title,
                        maxLines = 1,
                    )
                },
            )
        },
    ) { padding ->
        if (showSummary) {
            val orderedResults = pkg.course.modules
                .filter { it.kind == "quiz" }
                .flatMap { it.questions }
                .mapNotNull { progress.latestQuestionResults[it.id] }
            val quizList = progress.quizResults.values.toList()
            val correctCount = orderedResults.count { it.isCorrect }
            val score = if (orderedResults.isEmpty()) 100 else (correctCount * 100) / orderedResults.size
            val passed = quizList.all { it.passed }

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Text("Overall Accuracy: $score%", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                }
                items(orderedResults, key = { it.questionId }) { rec ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (rec.isCorrect) Color(0xFFECFDF5) else Color(0xFFFEF2F2)
                        ),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(rec.questionPrompt, fontWeight = FontWeight.SemiBold)
                            Text("Your answer: ${rec.userAnswerLabel} · Tries: ${rec.tries}", style = MaterialTheme.typography.bodySmall)
                            if (!rec.isCorrect) {
                                Text("Correct answer: ${rec.correctAnswerLabel}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                                Text("Explanation: ${rec.explanation}", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
                errorText?.let { err ->
                    item { Text(err, color = Color(0xFFB91C1C)) }
                }
                item {
                    if (isOffline) {
                        Button(
                            onClick = {
                                onSavePendingOffline(
                                    PendingOfflineSubmission(
                                        id = "pending-${pkg.courseId}-${System.currentTimeMillis()}",
                                        courseId = pkg.course._id,
                                        courseTitle = pkg.course.title,
                                        certificateTitle = pkg.course.certificateTitle,
                                        issuerName = pkg.course.issuerName,
                                        overallScore = score,
                                        passed = passed,
                                        completedOfflineAt = Instant.now().toString(),
                                        questionResults = orderedResults,
                                        quizResults = quizList,
                                    )
                                )
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        ) { Text("Save to Pending Queue (Offline)") }
                    } else {
                        Button(
                            onClick = {
                                if (user == null) {
                                    onRequireAuth()
                                    return@Button
                                }
                                scope.launch {
                                    runCatching { onSubmitOnline(score, passed, orderedResults, quizList) }
                                        .onFailure { errorText = it.message }
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        ) { Text("Submit Course to Admin") }
                    }
                }
            }
            return@Scaffold
        }

        if (mod == null) return@Scaffold

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (mod.kind == "lesson") {
                items(mod.blocks, key = { it.id }) { blk ->
                    when (blk.type) {
                        "header" -> Text(
                            blk.text.orEmpty(),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        "body" -> Text(blk.text.orEmpty(), style = MaterialTheme.typography.bodyLarge)
                        "bullets" -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            blk.items.forEach { bullet ->
                                Text("• $bullet", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        "image" -> {
                            val localPath = pkg.localMediaMap[blk.url]
                            val model: Any? = if (localPath != null && File(localPath).exists()) File(localPath)
                            else blk.url?.let { if (it.startsWith("http")) it else "${serverUrl.trimEnd('/')}$it" }
                            AsyncImage(
                                model = model,
                                contentDescription = blk.caption,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(12.dp)),
                            )
                        }
                        "video" -> {
                            val localPath = pkg.localMediaMap[blk.url]
                            val uri = if (localPath != null && File(localPath).exists()) {
                                Uri.fromFile(File(localPath))
                            } else {
                                val u = blk.url.orEmpty()
                                Uri.parse(if (u.startsWith("http")) u else "${serverUrl.trimEnd('/')}$u")
                            }
                            OfflineVideoPlayer(uri = uri)
                        }
                    }
                }
                item {
                    Button(
                        onClick = {
                            val completed = (progress.completedModuleIds + mod.id).distinct()
                            val isLast = progress.currentModuleIndex >= pkg.course.modules.lastIndex
                            val next = progress.copy(
                                completedModuleIds = completed,
                                currentModuleIndex = if (isLast) progress.currentModuleIndex else progress.currentModuleIndex + 1,
                                status = if (isLast) "completed" else "in_progress",
                                updatedAt = Instant.now().toString(),
                            )
                            progress = next
                            onProgressChange(next)
                            if (isLast) showSummary = true
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    ) { Text("Complete Lesson & Continue") }
                }
            } else {
                item {
                    Text(
                        "Passing Score: ${mod.passingScore ?: 70}%",
                        color = Color(0xFF1D4ED8),
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                if (feedbackBanner != null) {
                    val (passed, msg) = feedbackBanner!!
                    item {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = if (passed) Color(0xFFECFDF5) else Color(0xFFFEF2F2)
                            ),
                        ) {
                            Column(Modifier.padding(16.dp)) {
                                Text(msg, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(10.dp))
                                Button(onClick = {
                                    if (passed) {
                                        val isLast = progress.currentModuleIndex >= pkg.course.modules.lastIndex
                                        val next = progress.copy(
                                            currentModuleIndex = if (isLast) progress.currentModuleIndex else progress.currentModuleIndex + 1,
                                            status = if (isLast) "completed" else "in_progress",
                                        )
                                        progress = next
                                        onProgressChange(next)
                                        feedbackBanner = null
                                        answers = emptyMap()
                                        if (isLast) showSummary = true
                                    } else {
                                        val keepIds = pkg.course.modules.take(restartTargetIdx).map { it.id }.toSet()
                                        val next = progress.copy(
                                            currentModuleIndex = restartTargetIdx,
                                            completedModuleIds = progress.completedModuleIds.filter { keepIds.contains(it) },
                                            status = "in_progress",
                                        )
                                        progress = next
                                        onProgressChange(next)
                                        feedbackBanner = null
                                        answers = emptyMap()
                                    }
                                }) {
                                    Text(if (passed) "Continue" else "Apply Failure Rule & Continue")
                                }
                            }
                        }
                    }
                } else {
                    items(mod.questions, key = { it.id }) { q ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        ) {
                            Column(Modifier.padding(14.dp)) {
                                Text(q.prompt, fontWeight = FontWeight.SemiBold)
                                Spacer(Modifier.height(8.dp))
                                when (q.type) {
                                    "multiple_choice", "true_false" -> {
                                        val opts = if (q.type == "true_false") listOf("True", "False") else q.options
                                        val selected = (answers[q.id] as? QuizAnswerInput.SingleIndex)?.index
                                        opts.forEachIndexed { idx, opt ->
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                RadioButton(
                                                    selected = selected == idx,
                                                    onClick = { answers = answers + (q.id to QuizAnswerInput.SingleIndex(idx)) },
                                                )
                                                Text(opt)
                                            }
                                        }
                                    }
                                    "select_all" -> {
                                        val selected = (answers[q.id] as? QuizAnswerInput.MultiIndices)?.indices ?: emptySet()
                                        q.options.forEachIndexed { idx, opt ->
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Checkbox(
                                                    checked = selected.contains(idx),
                                                    onCheckedChange = { checked ->
                                                        val next = if (checked) selected + idx else selected - idx
                                                        answers = answers + (q.id to QuizAnswerInput.MultiIndices(next))
                                                    },
                                                )
                                                Text(opt)
                                            }
                                        }
                                    }
                                    else -> {
                                        val text = (answers[q.id] as? QuizAnswerInput.EssayText)?.text ?: ""
                                        OutlinedTextField(
                                            value = text,
                                            onValueChange = { answers = answers + (q.id to QuizAnswerInput.EssayText(it)) },
                                            label = { Text("Your written answer") },
                                            modifier = Modifier.fillMaxWidth(),
                                            minLines = 3,
                                        )
                                    }
                                }
                            }
                        }
                    }
                    item {
                        Button(
                            onClick = {
                                val res = QuizEngine.evaluateQuiz(mod, answers, progress.questionTries)
                                val nextQuizAttempts = progress.quizAttempts + (mod.id to ((progress.quizAttempts[mod.id] ?: 0) + 1))
                                val nextResultsMap = progress.latestQuestionResults.toMutableMap()
                                res.records.forEach { nextResultsMap[it.questionId] = it }
                                val nextQuizResults = progress.quizResults + (mod.id to QuizAttemptSummary(
                                    quizId = mod.id,
                                    quizTitle = mod.title,
                                    score = res.score,
                                    passingScore = mod.passingScore ?: 70,
                                    passed = res.passed,
                                    attempts = nextQuizAttempts[mod.id] ?: 1,
                                ))
                                val nextCompleted = if (res.passed) (progress.completedModuleIds + mod.id).distinct() else progress.completedModuleIds
                                val next = progress.copy(
                                    completedModuleIds = nextCompleted,
                                    questionTries = res.updatedTries,
                                    quizAttempts = nextQuizAttempts,
                                    latestQuestionResults = nextResultsMap,
                                    quizResults = nextQuizResults,
                                    status = "in_progress",
                                    updatedAt = Instant.now().toString(),
                                )
                                progress = next
                                onProgressChange(next)
                                restartTargetIdx = QuizEngine.getRestartTargetIndex(
                                    pkg.course.modules,
                                    progress.currentModuleIndex,
                                    mod.failureRule,
                                )
                                feedbackBanner = res.passed to (if (res.passed) "Quiz Passed (${res.score}%)" else "Scored ${res.score}% (below ${mod.passingScore ?: 70}%)")
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        ) { Text("Submit Quiz Answers") }
                    }
                }
            }
        }
    }
}

@Composable
private fun OfflineVideoPlayer(uri: Uri) {
    val context = LocalContext.current
    val player = remember(uri) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(uri))
            prepare()
        }
    }
    DisposableEffect(player) {
        onDispose { player.release() }
    }
    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                this.player = player
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
            }
        },
        modifier = Modifier.fillMaxWidth().height(210.dp).clip(RoundedCornerShape(12.dp)).background(Color.Black),
    )
}

@Composable
private fun AuthDialog(
    api: ApiClient,
    currentUser: UserAccount?,
    onDismiss: () -> Unit,
    onAuthenticated: (String, UserAccount) -> Unit,
    onSignOut: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var isRegister by remember { mutableStateOf(true) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    if (currentUser != null) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(currentUser.name) },
            text = { Text(currentUser.email) },
            confirmButton = {
                Button(onClick = onSignOut) { Text("Sign Out") }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) { Text("Close") }
            },
        )
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isRegister) "Create Learner Account" else "Sign In") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = isRegister, onClick = { isRegister = true }, label = { Text("Register") })
                    FilterChip(selected = !isRegister, onClick = { isRegister = false }, label = { Text("Sign In") })
                }
                if (isRegister) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Full Name") })
                }
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") })
                OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Password") })
                error?.let { Text(it, color = Color(0xFFB91C1C), style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Button(onClick = {
                scope.launch {
                    runCatching {
                        if (isRegister) api.register(name, email, password) else api.login(email, password)
                    }.onSuccess { res ->
                        onAuthenticated(res.token, res.user)
                    }.onFailure { err ->
                        error = err.message
                    }
                }
            }) { Text(if (isRegister) "Register" else "Sign In") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
