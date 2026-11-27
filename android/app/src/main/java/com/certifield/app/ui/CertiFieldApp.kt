package com.certifield.app.ui

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.view.ViewGroup
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import java.util.Locale
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

enum class LearnerTab(val label: String) {
    AVAILABLE("Courses"),
    DOWNLOADED("Saved"),
    FINISHED("Done"),
    CERTIFICATES("Certs"),
    STATS("Stats"),
}

private fun parseHexColor(hex: String?, fallback: Color): Color {
    val clean = hex?.trim()?.removePrefix("#") ?: return fallback
    if (clean.length != 6 && clean.length != 8) return fallback
    return runCatching {
        val parsed = clean.toLong(16)
        val argb = if (clean.length == 6) (0xFF000000L or parsed) else parsed
        Color(argb)
    }.getOrDefault(fallback)
}

@Composable
fun CertiFieldApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val store = remember { OfflineCourseStore(context) }

    var serverUrl by remember { mutableStateOf(store.loadServerUrl(BuildConfig.DEFAULT_SERVER_URL)) }
    val savedSession = remember { store.loadAuthSession() }
    val api = remember {
        ApiClient { serverUrl }.apply {
            if (savedSession != null) {
                token = savedSession.token
            }
        }
    }

    var isDarkMode by remember { mutableStateOf(store.loadDarkMode()) }
    var branding by remember { mutableStateOf(store.loadBranding()) }
    var cachedIconFile by remember { mutableStateOf(store.getCachedBrandingIconFile()) }

    // Signed-in state persists across offline/online transitions and restarts until user manually signs out
    var user by remember { mutableStateOf<UserAccount?>(savedSession?.user) }

    var hasNetworkTransport by remember {
        mutableStateOf(
            runCatching {
                val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                val caps = cm.getNetworkCapabilities(cm.activeNetwork)
                caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
            }.getOrDefault(false)
        )
    }
    var networkRevision by remember { mutableIntStateOf(0) }
    var isConnected by remember { mutableStateOf(false) }

    var activeTab by remember { mutableStateOf(LearnerTab.AVAILABLE) }
    var showAuthDialog by remember { mutableStateOf(false) }
    var showConnectionDialog by remember { mutableStateOf(false) }

    var courses by remember { mutableStateOf<List<Course>>(emptyList()) }
    var downloadedPackages by remember { mutableStateOf(store.loadPackages()) }
    var progressMap by remember { mutableStateOf(store.loadProgressMap()) }
    var pendingSubmissions by remember { mutableStateOf(store.loadPendingSubmissions()) }
    var submittedCourses by remember { mutableStateOf(store.loadCachedSubmissions()) }
    var certificates by remember { mutableStateOf(store.loadCachedCertificates()) }
    var downloadPct by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var activePlayerPkg by remember { mutableStateOf<DownloadedCoursePackage?>(null) }
    var statusFeedbackBanner by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var ratingDialogCourse by remember { mutableStateOf<Course?>(null) }

    // Automatic OS Wi-Fi / mobile data detection only (no manual offline/online toggle)
    DisposableEffect(context) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                hasNetworkTransport = true
                networkRevision += 1
            }

            override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
                val hasInternet = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                val validated = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                hasNetworkTransport = hasInternet
                if (!hasInternet) {
                    isConnected = false
                } else if (validated && !isConnected) {
                    networkRevision += 1
                }
            }

            override fun onLost(network: Network) {
                val caps = cm.getNetworkCapabilities(cm.activeNetwork)
                val stillHasNet = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
                hasNetworkTransport = stillHasNet
                if (!stillHasNet) {
                    isConnected = false
                }
            }
        }
        runCatching { cm.registerDefaultNetworkCallback(callback) }
        onDispose {
            runCatching { cm.unregisterNetworkCallback(callback) }
        }
    }

    fun refreshLocal() {
        downloadedPackages = store.loadPackages()
        progressMap = store.loadProgressMap()
        pendingSubmissions = store.loadPendingSubmissions()
    }

    suspend fun refreshRemote() {
        if (!hasNetworkTransport) {
            isConnected = false
            return
        }
        var healthy = api.checkHealth()
        if (!healthy) {
            delay(500L)
            healthy = api.checkHealth()
        }
        if (!healthy) {
            delay(1000L)
            healthy = api.checkHealth()
        }
        isConnected = healthy
        if (!healthy) {
            return
        }

        runCatching {
            val remoteBranding = api.fetchBranding()
            val saved = store.saveBranding(remoteBranding, serverUrl)
            branding = saved
            cachedIconFile = store.getCachedBrandingIconFile()
        }

        runCatching {
            val fetched = api.fetchCourses()
            courses = fetched
            store.syncDownloadedCoursesMetadata(fetched)
            downloadedPackages = store.loadPackages()
        }

        // Never auto-sign-out on transient failures; keep cached credentials until manual logout
        if (user != null && api.token != null) {
            runCatching {
                val subs = api.fetchMySubmissions()
                submittedCourses = subs
                store.saveCachedSubmissions(subs)
            }
            runCatching {
                val certs = api.fetchMyCertificates()
                certificates = certs
                store.saveCachedCertificates(certs)
            }
        }
    }

    LaunchedEffect(serverUrl, user, hasNetworkTransport, networkRevision) {
        refreshRemote()
    }

    val rawAccent = parseHexColor(branding.accentColor, Color(0xFF1D4ED8))
    val brandAccent = if (isDarkMode) Color(0xFF38BDF8) else rawAccent
    val colorScheme = if (isDarkMode) {
        darkColorScheme(
            primary = brandAccent,
            onPrimary = Color(0xFF041322),
            background = Color(0xFF030712),
            surface = Color(0xFF0B1222),
            surfaceVariant = Color(0xFF1E293B),
            onBackground = Color(0xFFF1F5F9),
            onSurface = Color(0xFFF1F5F9),
            onSurfaceVariant = Color(0xFF94A3B8),
            outline = Color(0xFF283548),
        )
    } else {
        lightColorScheme(
            primary = brandAccent,
            onPrimary = Color.White,
            background = Color(0xFFF4F7FB),
            surface = Color.White,
            surfaceVariant = Color(0xFFF1F5F9),
            onBackground = Color(0xFF0F172A),
            onSurface = Color(0xFF0F172A),
            onSurfaceVariant = Color(0xFF475569),
            outline = Color(0xFFE2E8F0),
        )
    }

    MaterialTheme(colorScheme = colorScheme) {
        val textPrimary = MaterialTheme.colorScheme.onBackground
        val textSecondary = MaterialTheme.colorScheme.onSurfaceVariant
        val cardBg = if (isDarkMode) Color(0xFF0B1222).copy(alpha = 0.86f) else Color.White.copy(alpha = 0.90f)
        val chromeBg = if (isDarkMode) Color(0xFF060B18).copy(alpha = 0.94f) else Color.White.copy(alpha = 0.92f)
        val borderColor = MaterialTheme.colorScheme.outline

        Box(modifier = Modifier.fillMaxSize()) {
            FuturisticAppBackdrop(
                isDarkMode = isDarkMode,
                accentColor = brandAccent,
            )

            if (activePlayerPkg != null) {
                val pkg = activePlayerPkg!!
                CoursePlayerScreen(
                    pkg = pkg,
                    serverUrl = serverUrl,
                    initialProgress = progressMap[pkg.courseId] ?: CourseProgressState(courseId = pkg.courseId),
                    isConnected = isConnected,
                    isDarkMode = isDarkMode,
                    onToggleDarkMode = {
                        isDarkMode = !isDarkMode
                        store.saveDarkMode(isDarkMode)
                    },
                    brandAccent = brandAccent,
                    user = user,
                    onProgressChange = { next ->
                        store.saveProgress(next)
                        refreshLocal()
                    },
                    onSubmitOnline = { score, passed, readingSecs, qRes, quizRes ->
                        api.submitCourse(
                            courseId = pkg.course._id,
                            courseTitle = pkg.course.title,
                            certificateTitle = pkg.course.certificateTitle,
                            issuerName = pkg.course.issuerName,
                            overallScore = score,
                            passed = passed,
                            completedOfflineAt = null,
                            readingDurationSeconds = readingSecs,
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
                return@Box
            }

            Scaffold(
                containerColor = Color.Transparent,
                topBar = {
                    Surface(
                        color = chromeBg,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .statusBarsPadding()
                                    .padding(horizontal = 10.dp, vertical = 10.dp),
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.weight(1f),
                                ) {
                                    BrandLogoBadge(
                                        cachedIconFile = cachedIconFile,
                                        branding = branding,
                                        serverUrl = serverUrl,
                                        isConnected = isConnected,
                                        brandAccent = brandAccent,
                                    )
                                    Text(
                                        text = branding.systemName.ifBlank { "CertiField" },
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        color = textPrimary,
                                    )
                                }

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                                ) {
                                    Surface(
                                        onClick = {
                                            isDarkMode = !isDarkMode
                                            store.saveDarkMode(isDarkMode)
                                        },
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (isDarkMode) Color(0xFF0F172A) else Color(0xFFF8FAFC),
                                        border = BorderStroke(1.dp, borderColor),
                                        modifier = Modifier.size(34.dp),
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = if (isDarkMode) Icons.Default.LightMode else Icons.Default.DarkMode,
                                                contentDescription = if (isDarkMode) "Switch to Light Mode" else "Switch to Dark Mode",
                                                tint = if (isDarkMode) Color(0xFFFBBF24) else textPrimary,
                                                modifier = Modifier.size(17.dp),
                                            )
                                        }
                                    }

                                    if (!isConnected) {
                                        Surface(
                                            onClick = { showConnectionDialog = true },
                                            shape = RoundedCornerShape(10.dp),
                                            color = if (isDarkMode) Color(0xFF1E293B).copy(alpha = 0.85f) else Color(0xFFF8FAFC),
                                            border = BorderStroke(1.dp, borderColor),
                                            modifier = Modifier.size(34.dp),
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Icon(
                                                    imageVector = Icons.Default.WifiOff,
                                                    contentDescription = "No internet connection",
                                                    tint = if (isDarkMode) Color(0xFFFBBF24) else Color(0xFFD97706),
                                                    modifier = Modifier.size(17.dp),
                                                )
                                            }
                                        }
                                    }

                                    Surface(
                                        onClick = { showConnectionDialog = true },
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (isDarkMode) Color(0xFF0F172A) else Color(0xFFF8FAFC),
                                        border = BorderStroke(
                                            1.dp,
                                            if (isConnected) Color(0xFF10B981).copy(alpha = 0.65f) else borderColor,
                                        ),
                                        modifier = Modifier.height(34.dp),
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.padding(horizontal = 7.dp),
                                        ) {
                                            if (isConnected) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(7.dp)
                                                        .clip(CircleShape)
                                                        .background(Color(0xFF10B981))
                                                )
                                                Spacer(Modifier.width(5.dp))
                                            }
                                            Text(
                                                "CONNECTION",
                                                fontSize = 9.5.sp,
                                                fontFamily = FontFamily.Monospace,
                                                fontWeight = FontWeight.Bold,
                                                maxLines = 1,
                                                softWrap = false,
                                                color = textPrimary,
                                            )
                                        }
                                    }

                                    Surface(
                                        onClick = { showAuthDialog = true },
                                        shape = RoundedCornerShape(10.dp),
                                        color = brandAccent.copy(alpha = if (isDarkMode) 0.16f else 0.10f),
                                        border = BorderStroke(1.dp, brandAccent.copy(alpha = 0.45f)),
                                        modifier = Modifier.height(34.dp),
                                    ) {
                                        Box(
                                            contentAlignment = Alignment.Center,
                                            modifier = Modifier.padding(horizontal = 8.dp),
                                        ) {
                                            Text(
                                                text = user?.name?.split(" ")?.firstOrNull() ?: "Sign In",
                                                fontSize = 11.sp,
                                                maxLines = 1,
                                                softWrap = false,
                                                overflow = TextOverflow.Ellipsis,
                                                fontWeight = FontWeight.Bold,
                                                color = brandAccent,
                                            )
                                        }
                                    }
                                }
                            }
                            HorizontalDivider(color = borderColor)
                        }
                    }
                },
                bottomBar = {
                    Surface(
                        color = chromeBg,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column {
                            HorizontalDivider(color = borderColor)
                            BoxWithConstraints(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .navigationBarsPadding()
                                    .padding(horizontal = 6.dp, vertical = 6.dp),
                            ) {
                                val tabCount = LearnerTab.entries.size
                                val tabWidth = maxWidth / tabCount
                                val indicatorOffset by animateDpAsState(
                                    targetValue = tabWidth * activeTab.ordinal,
                                    animationSpec = spring(
                                        dampingRatio = Spring.DampingRatioNoBouncy,
                                        stiffness = Spring.StiffnessMediumLow,
                                    ),
                                    label = "bottom_nav_indicator_offset",
                                )

                                Box(
                                    modifier = Modifier
                                        .offset(x = indicatorOffset)
                                        .width(tabWidth)
                                        .height(54.dp)
                                        .padding(horizontal = 2.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(
                                            brandAccent.copy(alpha = if (isDarkMode) 0.18f else 0.12f)
                                        ),
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    LearnerTab.entries.forEach { tab ->
                                        val selected = activeTab == tab
                                        val icon = when (tab) {
                                            LearnerTab.AVAILABLE -> Icons.Default.MenuBook
                                            LearnerTab.DOWNLOADED -> Icons.Default.DownloadDone
                                            LearnerTab.FINISHED -> Icons.Default.CheckCircle
                                            LearnerTab.CERTIFICATES -> Icons.Default.WorkspacePremium
                                            LearnerTab.STATS -> Icons.Default.BarChart
                                        }
                                        val tabTint by animateColorAsState(
                                            targetValue = if (selected) brandAccent else textSecondary,
                                            animationSpec = tween(durationMillis = 220),
                                            label = "tab_tint_${tab.name}",
                                        )
                                        val iconScale by animateFloatAsState(
                                            targetValue = if (selected) 1.12f else 1.0f,
                                            animationSpec = spring(
                                                dampingRatio = Spring.DampingRatioMediumBouncy,
                                                stiffness = Spring.StiffnessMedium,
                                            ),
                                            label = "tab_scale_${tab.name}",
                                        )
                                        Surface(
                                            onClick = {
                                                if (activeTab != tab) {
                                                    activeTab = tab
                                                    scope.launch { refreshRemote() }
                                                }
                                            },
                                            shape = RoundedCornerShape(12.dp),
                                            color = Color.Transparent,
                                            modifier = Modifier
                                                .weight(1f)
                                                .height(54.dp),
                                        ) {
                                            Column(
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                                verticalArrangement = Arrangement.Center,
                                                modifier = Modifier
                                                    .fillMaxSize()
                                                    .padding(horizontal = 2.dp),
                                            ) {
                                                Icon(
                                                    imageVector = icon,
                                                    contentDescription = tab.label,
                                                    tint = tabTint,
                                                    modifier = Modifier
                                                        .size(20.dp)
                                                        .scale(iconScale),
                                                )
                                                Spacer(Modifier.height(3.dp))
                                                Text(
                                                    text = tab.label,
                                                    maxLines = 1,
                                                    softWrap = false,
                                                    overflow = TextOverflow.Ellipsis,
                                                    fontSize = 11.sp,
                                                    lineHeight = 12.sp,
                                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                                    color = tabTint,
                                                )
                                            }
                                        }
                                    }
                                }
                            }
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
                    statusFeedbackBanner?.let { (isSuccess, msg) ->
                        Surface(
                            color = if (isSuccess) {
                                if (isDarkMode) Color(0xFF064E3B).copy(alpha = 0.78f) else Color(0xFFECFDF5)
                            } else {
                                if (isDarkMode) Color(0xFF7F1D1D).copy(alpha = 0.75f) else Color(0xFFFEF2F2)
                            },
                            border = BorderStroke(
                                1.dp,
                                if (isSuccess) {
                                    if (isDarkMode) Color(0xFF10B981).copy(alpha = 0.6f) else Color(0xFFA7F3D0)
                                } else {
                                    if (isDarkMode) Color(0xFFEF4444).copy(alpha = 0.6f) else Color(0xFFFECACA)
                                }
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp),
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                            ) {
                                Icon(
                                    imageVector = if (isSuccess) Icons.Default.CheckCircle else Icons.Default.ErrorOutline,
                                    contentDescription = null,
                                    tint = if (isSuccess) {
                                        if (isDarkMode) Color(0xFF34D399) else Color(0xFF059669)
                                    } else {
                                        if (isDarkMode) Color(0xFFFCA5A5) else Color(0xFFDC2626)
                                    },
                                    modifier = Modifier.size(18.dp),
                                )
                                Text(
                                    text = msg,
                                    color = if (isSuccess) {
                                        if (isDarkMode) Color(0xFFD1FAE5) else Color(0xFF065F46)
                                    } else {
                                        if (isDarkMode) Color(0xFFFEE2E2) else Color(0xFF991B1B)
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f),
                                )
                                IconButton(
                                    onClick = { statusFeedbackBanner = null },
                                    modifier = Modifier.size(28.dp),
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Dismiss",
                                        tint = textSecondary,
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            }
                        }
                    }

                    AnimatedContent(
                        targetState = activeTab,
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        transitionSpec = {
                            val forward = targetState.ordinal >= initialState.ordinal
                            val enter = slideInHorizontally(animationSpec = tween(220)) { width ->
                                if (forward) width / 8 else -width / 8
                            } + fadeIn(animationSpec = tween(220))
                            val exit = slideOutHorizontally(animationSpec = tween(180)) { width ->
                                if (forward) -width / 10 else width / 10
                            } + fadeOut(animationSpec = tween(160))
                            enter togetherWith exit
                        },
                        label = "learner_tab_content",
                    ) { tab ->
                    when (tab) {
                        LearnerTab.AVAILABLE -> AvailableCoursesTab(
                            courses = courses,
                            serverUrl = serverUrl,
                            downloadedIds = downloadedPackages.map { it.courseId }.toSet(),
                            downloadPct = downloadPct,
                            isConnected = isConnected,
                            isDarkMode = isDarkMode,
                            brandAccent = brandAccent,
                            cardBg = cardBg,
                            borderColor = borderColor,
                            textPrimary = textPrimary,
                            textSecondary = textSecondary,
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
                                    if (isConnected) {
                                        api.trackCourseDownload(course._id)
                                    }
                                    downloadPct = downloadPct - course._id
                                    refreshLocal()
                                    statusFeedbackBanner = true to "Saved \"${course.title}\" for offline study."
                                }
                            },
                            onOpen = { courseId ->
                                activePlayerPkg = downloadedPackages.firstOrNull { it.courseId == courseId }
                            },
                            onRateCourse = { course ->
                                if (user == null) {
                                    showAuthDialog = true
                                } else if (!isConnected) {
                                    statusFeedbackBanner = false to "Connect to Wi-Fi or your server to submit a course rating."
                                } else {
                                    ratingDialogCourse = course
                                }
                            },
                        )

                        LearnerTab.DOWNLOADED -> DownloadedCoursesTab(
                            packages = downloadedPackages,
                            progressMap = progressMap,
                            serverUrl = serverUrl,
                            isDarkMode = isDarkMode,
                            brandAccent = brandAccent,
                            cardBg = cardBg,
                            borderColor = borderColor,
                            textPrimary = textPrimary,
                            textSecondary = textSecondary,
                            onOpen = { pkg -> activePlayerPkg = pkg },
                            onRemove = { courseId ->
                                store.removeCourse(courseId)
                                refreshLocal()
                            },
                            onRateCourse = { course ->
                                if (user == null) {
                                    showAuthDialog = true
                                } else if (!isConnected) {
                                    statusFeedbackBanner = false to "Connect to Wi-Fi or your server to submit a course rating."
                                } else {
                                    ratingDialogCourse = course
                                }
                            },
                        )

                        LearnerTab.FINISHED -> FinishedCoursesTab(
                            pending = pendingSubmissions,
                            submitted = submittedCourses,
                            isConnected = isConnected,
                            isDarkMode = isDarkMode,
                            brandAccent = brandAccent,
                            cardBg = cardBg,
                            borderColor = borderColor,
                            textPrimary = textPrimary,
                            textSecondary = textSecondary,
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
                                            readingDurationSeconds = item.readingDurationSeconds,
                                            questionResults = item.questionResults,
                                            quizResults = item.quizResults,
                                        )
                                        store.removePendingSubmission(item.id)
                                        refreshLocal()
                                        refreshRemote()
                                        statusFeedbackBanner = true to "Submitted \"${item.courseTitle}\" for admin review."
                                    }.onFailure {
                                        statusFeedbackBanner = false to (it.message ?: "Unable to submit pending course.")
                                    }
                                }
                            },
                            onRequireAuth = { showAuthDialog = true },
                        )

                        LearnerTab.CERTIFICATES -> CertificatesTab(
                            certificates = certificates,
                            user = user,
                            isConnected = isConnected,
                            brandAccent = brandAccent,
                            cardBg = cardBg,
                            borderColor = borderColor,
                            textPrimary = textPrimary,
                            textSecondary = textSecondary,
                            onViewPdf = { cert -> CertificatePdfHelper.openPdf(context, cert) },
                            onEmailPdf = { cert -> CertificatePdfHelper.emailPdf(context, cert) },
                            onRequireAuth = { showAuthDialog = true },
                        )

                        LearnerTab.STATS -> StatsDashboardScreen(
                            downloadedPackages = downloadedPackages,
                            progressMap = progressMap,
                            pendingSubmissions = pendingSubmissions,
                            submittedCourses = submittedCourses,
                            certificates = certificates,
                            isDarkMode = isDarkMode,
                            brandAccent = brandAccent,
                        )
                    }
                    }
                }
            }
        }

        if (showAuthDialog) {
            AuthDialog(
                api = api,
                isConnected = isConnected,
                isDarkMode = isDarkMode,
                currentUser = user,
                brandAccent = brandAccent,
                onDismiss = { showAuthDialog = false },
                onAuthenticated = { token, account ->
                    api.token = token
                    user = account
                    store.saveAuthSession(
                        SavedAuthSession(
                            token = token,
                            user = account,
                            serverUrl = serverUrl,
                            savedAt = Instant.now().toString(),
                        )
                    )
                    showAuthDialog = false
                    scope.launch { refreshRemote() }
                },
                onSignOut = {
                    api.token = null
                    user = null
                    store.clearAuthSession()
                    submittedCourses = emptyList()
                    certificates = emptyList()
                    showAuthDialog = false
                },
            )
        }

        if (showConnectionDialog) {
            ConnectionConfigDialog(
                currentUrl = serverUrl,
                defaultHostedUrl = BuildConfig.DEFAULT_SERVER_URL,
                isDarkMode = isDarkMode,
                brandAccent = brandAccent,
                onDismiss = { showConnectionDialog = false },
                onSaveAndConnect = { normalizedUrl ->
                    serverUrl = normalizedUrl
                    store.saveServerUrl(normalizedUrl)
                    showConnectionDialog = false
                    scope.launch { refreshRemote() }
                },
            )
        }

        ratingDialogCourse?.let { targetCourse ->
            CourseRatingDialog(
                course = targetCourse,
                api = api,
                isDarkMode = isDarkMode,
                brandAccent = brandAccent,
                onDismiss = { ratingDialogCourse = null },
                onRated = { updated ->
                    val nextList = courses.map { if (it._id == updated._id) updated else it }
                    courses = if (nextList.any { it._id == updated._id }) nextList else courses
                    store.syncDownloadedCoursesMetadata(listOf(updated))
                    downloadedPackages = store.loadPackages()
                    ratingDialogCourse = null
                    statusFeedbackBanner = true to "Rated \"${updated.title}\" ${updated.userRating ?: 5}★ (Avg ${String.format(Locale.US, "%.1f", updated.averageRating)}★ from ${updated.ratingCount} ratings)."
                },
            )
        }
    }
}

@Composable
private fun SectionHeaderBlock(
    kicker: String,
    title: String,
    subtitle: String,
    accent: Color,
    textPrimary: Color,
    textSecondary: Color,
) {
    Column(modifier = Modifier.padding(top = 12.dp, bottom = 6.dp)) {
        Text(
            text = kicker,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
            color = accent,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.ExtraBold,
            color = textPrimary,
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = textSecondary,
        )
    }
}

@Composable
private fun FuturisticAppBackdrop(
    isDarkMode: Boolean,
    accentColor: Color,
) {
    val baseBg = if (isDarkMode) Color(0xFF030712) else Color(0xFFF4F7FB)
    val glowTop = if (isDarkMode) accentColor.copy(alpha = 0.24f) else accentColor.copy(alpha = 0.13f)
    val glowBottom = if (isDarkMode) Color(0xFF0EA5E9).copy(alpha = 0.16f) else Color(0xFF0284C7).copy(alpha = 0.09f)
    val gridColor = if (isDarkMode) Color(0xFF1E293B).copy(alpha = 0.48f) else Color(0xFFCBD5E1).copy(alpha = 0.42f)
    val nodeColor = if (isDarkMode) Color(0xFF38BDF8) else Color(0xFF1D4ED8)

    val transition = rememberInfiniteTransition(label = "futuristic_constellation")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 16000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "phase",
    )

    val nodeSeeds = remember {
        listOf(
            floatArrayOf(0.14f, 0.18f, 0.5f, 1.0f),
            floatArrayOf(0.36f, 0.12f, 1.4f, 0.8f),
            floatArrayOf(0.68f, 0.21f, 2.3f, 1.1f),
            floatArrayOf(0.86f, 0.14f, 3.1f, 0.9f),
            floatArrayOf(0.22f, 0.42f, 0.9f, 1.2f),
            floatArrayOf(0.54f, 0.38f, 2.1f, 0.7f),
            floatArrayOf(0.80f, 0.48f, 3.8f, 1.0f),
            floatArrayOf(0.12f, 0.68f, 4.4f, 0.9f),
            floatArrayOf(0.44f, 0.74f, 5.1f, 1.1f),
            floatArrayOf(0.72f, 0.69f, 1.8f, 0.8f),
            floatArrayOf(0.90f, 0.82f, 2.7f, 1.0f),
            floatArrayOf(0.28f, 0.88f, 3.5f, 0.9f),
        )
    }

    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .background(baseBg),
    ) {
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(glowTop, Color.Transparent),
                center = Offset(size.width * 0.86f, size.height * 0.08f),
                radius = size.width * 0.9f,
            )
        )
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(glowBottom, Color.Transparent),
                center = Offset(size.width * 0.10f, size.height * 0.88f),
                radius = size.width * 0.8f,
            )
        )

        val step = 32.dp.toPx()
        var x = 0f
        while (x < size.width) {
            drawLine(color = gridColor, start = Offset(x, 0f), end = Offset(x, size.height), strokeWidth = 1f)
            x += step
        }
        var y = 0f
        while (y < size.height) {
            drawLine(color = gridColor, start = Offset(0f, y), end = Offset(size.width, y), strokeWidth = 1f)
            y += step
        }

        val pts = ArrayList<Offset>(nodeSeeds.size)
        val driftPx = 14.dp.toPx()
        nodeSeeds.forEach { s ->
            val px = s[0] * size.width + cos(phase * s[3] + s[2]) * driftPx
            val py = s[1] * size.height + sin(phase * s[3] + s[2]) * driftPx
            pts.add(Offset(px, py))
        }

        val maxDist = size.width * 0.36f
        for (i in pts.indices) {
            for (j in i + 1 until pts.size) {
                val dx = pts[i].x - pts[j].x
                val dy = pts[i].y - pts[j].y
                val distSq = dx * dx + dy * dy
                if (distSq < maxDist * maxDist) {
                    val alpha = (1f - kotlin.math.sqrt(distSq) / maxDist) * (if (isDarkMode) 0.22f else 0.14f)
                    drawLine(
                        color = nodeColor.copy(alpha = alpha),
                        start = pts[i],
                        end = pts[j],
                        strokeWidth = 1.1f,
                    )
                }
            }
            drawCircle(
                color = nodeColor.copy(alpha = if (isDarkMode) 0.40f else 0.26f),
                radius = 2.6.dp.toPx(),
                center = pts[i],
            )
        }
    }
}

@Composable
private fun BrandLogoBadge(
    cachedIconFile: File?,
    branding: SystemBranding,
    serverUrl: String,
    isConnected: Boolean,
    brandAccent: Color,
) {
    val iconUrl = branding.iconUrl.trim()
    val model: Any? = when {
        cachedIconFile != null && cachedIconFile.exists() -> cachedIconFile
        isConnected && iconUrl.isNotEmpty() && !iconUrl.endsWith(".svg", ignoreCase = true) -> {
            if (iconUrl.startsWith("http", ignoreCase = true) || iconUrl.startsWith("data:", ignoreCase = true)) {
                iconUrl
            } else {
                "${ApiClient.normalizeConnectionUrl(serverUrl)}$iconUrl"
            }
        }
        isConnected && iconUrl == "/icon.svg" -> "${ApiClient.normalizeConnectionUrl(serverUrl)}/pwa-192x192.png"
        else -> null
    }

    if (model != null) {
        AsyncImage(
            model = model,
            contentDescription = "${branding.systemName} icon",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp)),
        )
    } else {
        Surface(
            color = brandAccent.copy(alpha = 0.16f),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.size(28.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.School,
                    contentDescription = null,
                    tint = brandAccent,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

@Composable
private fun ConnectionConfigDialog(
    currentUrl: String,
    defaultHostedUrl: String,
    isDarkMode: Boolean,
    brandAccent: Color,
    onDismiss: () -> Unit,
    onSaveAndConnect: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var urlDraft by remember { mutableStateOf(currentUrl) }
    var testing by remember { mutableStateOf(false) }
    var testResult by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = if (isDarkMode) Color(0xFF0F172A) else Color.White,
        shape = RoundedCornerShape(20.dp),
        title = {
            Column {
                Text(
                    "SERVER CONNECTION",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color = brandAccent,
                )
                Text("Configure Host URL", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Enter a LAN IP (e.g. 192.168.1.50:3000), Android Emulator host (10.0.2.2:3000), or a hosted HTTPS site link.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = urlDraft,
                    onValueChange = {
                        urlDraft = it
                        testResult = null
                    },
                    label = { Text("Connection String / URL") },
                    placeholder = { Text("http://192.168.1.50:3000") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    FilterChip(
                        selected = urlDraft.trim().contains("10.0.2.2"),
                        onClick = {
                            urlDraft = "http://10.0.2.2:3000"
                            testResult = null
                        },
                        label = { Text("Emulator", maxLines = 1, fontSize = 11.sp) },
                    )
                    FilterChip(
                        selected = urlDraft.trim() == defaultHostedUrl.trim(),
                        onClick = {
                            urlDraft = defaultHostedUrl
                            testResult = null
                        },
                        label = { Text("Hosted Site", maxLines = 1, fontSize = 11.sp) },
                    )
                }
                OutlinedButton(
                    onClick = {
                        val normalized = ApiClient.normalizeConnectionUrl(urlDraft)
                        if (normalized.isEmpty()) {
                            testResult = false to "Please enter a valid IP or URL."
                            return@OutlinedButton
                        }
                        testing = true
                        testResult = null
                        scope.launch {
                            val ok = runCatching {
                                val tempClient = ApiClient { normalized }
                                val healthy = tempClient.checkHealth()
                                if (!healthy) return@runCatching false to "Server unreachable at $normalized"
                                val fetched = tempClient.fetchBranding(normalized)
                                true to "Connected to ${fetched.systemName} ($normalized)"
                            }.getOrElse { err ->
                                false to (err.message ?: "Connection failed")
                            }
                            testResult = ok
                            testing = false
                        }
                    },
                    enabled = !testing,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (testing) "Testing..." else "Test Connection & Branding")
                }
                testResult?.let { (ok, msg) ->
                    Text(
                        text = msg,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (ok) Color(0xFF10B981) else Color(0xFFEF4444),
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val normalized = ApiClient.normalizeConnectionUrl(urlDraft)
                    if (normalized.isNotEmpty()) {
                        onSaveAndConnect(normalized)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
            ) {
                Text("Save & Connect")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@Composable
private fun CourseRatingRow(
    course: Course,
    isDarkMode: Boolean,
    textSecondary: Color,
) {
    val starColor = if (isDarkMode) Color(0xFFFBBF24) else Color(0xFFD97706)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(
            imageVector = Icons.Default.Star,
            contentDescription = null,
            tint = if (course.ratingCount > 0) starColor else textSecondary.copy(alpha = 0.45f),
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = if (course.ratingCount > 0) {
                "${String.format(Locale.US, "%.1f", course.averageRating)} (${course.ratingCount})"
            } else {
                "No ratings yet"
            },
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (course.ratingCount > 0) starColor else textSecondary,
        )
        course.userRating?.let { mine ->
            Text(
                text = "· Your rating: ${mine}★",
                fontSize = 11.sp,
                color = textSecondary,
            )
        }
    }
}

@Composable
private fun AvailableCoursesTab(
    courses: List<Course>,
    serverUrl: String,
    downloadedIds: Set<String>,
    downloadPct: Map<String, Int>,
    isConnected: Boolean,
    isDarkMode: Boolean,
    brandAccent: Color,
    cardBg: Color,
    borderColor: Color,
    textPrimary: Color,
    textSecondary: Color,
    onDownload: (Course) -> Unit,
    onOpen: (String) -> Unit,
    onRateCourse: (Course) -> Unit,
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("All") }
    var ratingFilter by remember { mutableStateOf("all") } // "all" | "four_plus" | "highest_rated" | "most_rated"

    val categories = remember(courses) {
        listOf("All") + courses.map { it.category.trim() }.filter { it.isNotEmpty() }.distinct().sorted()
    }

    val filteredCourses = remember(courses, searchQuery, selectedCategory, ratingFilter) {
        val q = searchQuery.trim().lowercase()
        val matched = courses.filter { course ->
            val categoryMatch = selectedCategory == "All" || course.category == selectedCategory
            val queryMatch = q.isEmpty() ||
                course.title.lowercase().contains(q) ||
                course.description.lowercase().contains(q) ||
                course.category.lowercase().contains(q)
            val ratingMatch = when (ratingFilter) {
                "four_plus" -> course.ratingCount > 0 && course.averageRating >= 4.0
                else -> true
            }
            categoryMatch && queryMatch && ratingMatch
        }
        when (ratingFilter) {
            "highest_rated", "four_plus" -> matched.sortedWith(
                compareByDescending<Course> { it.averageRating }.thenByDescending { it.ratingCount }
            )
            "most_rated" -> matched.sortedWith(
                compareByDescending<Course> { it.ratingCount }.thenByDescending { it.averageRating }
            )
            else -> matched
        }
    }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 16.dp),
    ) {
        item {
            SectionHeaderBlock(
                kicker = "OFFLINE CATALOG",
                title = "Available Courses",
                subtitle = "Search, filter by rating or topic, rate courses, and download for offline field study.",
                accent = brandAccent,
                textPrimary = textPrimary,
                textSecondary = textSecondary,
            )
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search courses by title, topic, or category...") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search",
                            tint = textSecondary,
                        )
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Clear search",
                                    tint = textSecondary,
                                )
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                )

                if (categories.size > 1) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(categories) { cat ->
                            FilterChip(
                                selected = selectedCategory == cat,
                                onClick = { selectedCategory = cat },
                                label = { Text(cat, maxLines = 1, fontSize = 12.sp) },
                            )
                        }
                    }
                }

                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val ratingOptions = listOf(
                        "all" to "All Ratings",
                        "highest_rated" to "Highest Rated",
                        "most_rated" to "Most Rated",
                        "four_plus" to "4+ Stars",
                    )
                    items(ratingOptions) { (key, label) ->
                        FilterChip(
                            selected = ratingFilter == key,
                            onClick = { ratingFilter = key },
                            leadingIcon = if (key != "all") {
                                {
                                    Icon(
                                        imageVector = Icons.Default.Star,
                                        contentDescription = null,
                                        modifier = Modifier.size(15.dp),
                                    )
                                }
                            } else null,
                            label = { Text(label, maxLines = 1, fontSize = 12.sp) },
                        )
                    }
                }
            }
        }

        if (courses.isEmpty()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = BorderStroke(1.dp, borderColor),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Text(
                        text = if (isConnected) "No published courses available yet."
                        else "No network connection. Open Saved tab for downloaded courses.",
                        color = textSecondary,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(20.dp),
                    )
                }
            }
        } else if (filteredCourses.isEmpty()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = BorderStroke(1.dp, borderColor),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(20.dp),
                    ) {
                        Text(
                            text = "No courses match your search or filter.",
                            color = textPrimary,
                            fontWeight = FontWeight.SemiBold,
                        )
                        TextButton(
                            onClick = {
                                searchQuery = ""
                                selectedCategory = "All"
                                ratingFilter = "all"
                            },
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            Text("Reset Search & Filters", color = brandAccent)
                        }
                    }
                }
            }
        } else {
            items(filteredCourses, key = { it._id }) { course ->
                val isDownloaded = downloadedIds.contains(course._id)
                val pct = downloadPct[course._id]
                val normalizedBase = ApiClient.normalizeConnectionUrl(serverUrl)
                val bannerModel = if (course.bannerUrl.startsWith("http")) course.bannerUrl
                else "$normalizedBase${course.bannerUrl}"

                Card(
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = BorderStroke(1.dp, borderColor),
                    shape = RoundedCornerShape(18.dp),
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
                                "${course.category.uppercase()} · ${course.modules.count { it.kind == "lesson" }} LESSONS · ${course.modules.count { it.kind == "quiz" }} QUIZZES",
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                color = brandAccent,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                course.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = textPrimary,
                            )
                            Spacer(Modifier.height(6.dp))
                            CourseRatingRow(
                                course = course,
                                isDarkMode = isDarkMode,
                                textSecondary = textSecondary,
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                course.description,
                                style = MaterialTheme.typography.bodyMedium,
                                color = textSecondary,
                            )
                            Spacer(Modifier.height(14.dp))
                            if (pct != null) {
                                LinearProgressIndicator(
                                    progress = { pct / 100f },
                                    color = brandAccent,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "Downloading offline media: $pct%",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = textSecondary,
                                )
                            } else {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    if (isDownloaded) {
                                        Button(
                                            onClick = { onOpen(course._id) },
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (isDarkMode) Color(0xFF059669) else Color(0xFF15803D)
                                            ),
                                            modifier = Modifier.weight(1f).height(48.dp),
                                        ) {
                                            Text(
                                                "Open Saved",
                                                color = Color.White,
                                                fontWeight = FontWeight.Bold,
                                                maxLines = 1,
                                            )
                                        }
                                    } else {
                                        Button(
                                            onClick = { onDownload(course) },
                                            enabled = isConnected,
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                                            modifier = Modifier.weight(1f).height(48.dp),
                                        ) {
                                            Icon(
                                                Icons.Default.Download,
                                                contentDescription = null,
                                                modifier = Modifier.size(18.dp),
                                            )
                                            Spacer(Modifier.width(6.dp))
                                            Text(
                                                if (!isConnected) "Offline" else "Download",
                                                maxLines = 1,
                                            )
                                        }
                                    }
                                    OutlinedButton(
                                        onClick = { onRateCourse(course) },
                                        shape = RoundedCornerShape(12.dp),
                                        border = BorderStroke(1.dp, borderColor),
                                        modifier = Modifier.height(48.dp),
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Star,
                                            contentDescription = "Rate course",
                                            tint = if (isDarkMode) Color(0xFFFBBF24) else Color(0xFFD97706),
                                            modifier = Modifier.size(17.dp),
                                        )
                                        Spacer(Modifier.width(4.dp))
                                        Text(
                                            text = course.userRating?.let { "${it}★" } ?: "Rate",
                                            maxLines = 1,
                                            color = textPrimary,
                                            fontWeight = FontWeight.SemiBold,
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
}

@Composable
private fun DownloadedCoursesTab(
    packages: List<DownloadedCoursePackage>,
    progressMap: Map<String, CourseProgressState>,
    serverUrl: String,
    isDarkMode: Boolean,
    brandAccent: Color,
    cardBg: Color,
    borderColor: Color,
    textPrimary: Color,
    textSecondary: Color,
    onOpen: (DownloadedCoursePackage) -> Unit,
    onRemove: (String) -> Unit,
    onRateCourse: (Course) -> Unit,
) {
    var searchQuery by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf("all") } // "all" | "not_started" | "in_progress" | "completed"
    var ratingFilter by remember { mutableStateOf("all") } // "all" | "four_plus" | "highest_rated" | "most_rated"

    val filtered = remember(packages, progressMap, searchQuery, statusFilter, ratingFilter) {
        val q = searchQuery.trim().lowercase()
        val matched = packages.filter { pkg ->
            val status = progressMap[pkg.courseId]?.status ?: "not_started"
            val statusOk = when (statusFilter) {
                "not_started" -> status == "not_started"
                "in_progress" -> status == "in_progress"
                "completed" -> status == "completed"
                else -> true
            }
            val queryOk = q.isEmpty() ||
                pkg.course.title.lowercase().contains(q) ||
                pkg.course.description.lowercase().contains(q) ||
                pkg.course.category.lowercase().contains(q)
            val ratingOk = when (ratingFilter) {
                "four_plus" -> pkg.course.ratingCount > 0 && pkg.course.averageRating >= 4.0
                else -> true
            }
            statusOk && queryOk && ratingOk
        }
        when (ratingFilter) {
            "highest_rated", "four_plus" -> matched.sortedWith(
                compareByDescending<DownloadedCoursePackage> { it.course.averageRating }
                    .thenByDescending { it.course.ratingCount }
            )
            "most_rated" -> matched.sortedWith(
                compareByDescending<DownloadedCoursePackage> { it.course.ratingCount }
                    .thenByDescending { it.course.averageRating }
            )
            else -> matched
        }
    }

    Column(Modifier.fillMaxSize()) {
        SectionHeaderBlock(
            kicker = "LOCAL LIBRARY",
            title = "Saved Courses",
            subtitle = "Stored directly on your device for uninterrupted offline study.",
            accent = brandAccent,
            textPrimary = textPrimary,
            textSecondary = textSecondary,
        )

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search saved courses...") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search saved courses",
                    tint = textSecondary,
                )
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Clear search",
                            tint = textSecondary,
                        )
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 6.dp),
        ) {
            val statusOptions = listOf(
                "all" to "All",
                "not_started" to "New",
                "in_progress" to "In Progress",
                "completed" to "Completed",
            )
            items(statusOptions) { (key, label) ->
                FilterChip(
                    selected = statusFilter == key,
                    onClick = { statusFilter = key },
                    label = { Text(label, maxLines = 1, fontSize = 12.sp) },
                )
            }
        }

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 10.dp),
        ) {
            val ratingOptions = listOf(
                "all" to "All Ratings",
                "highest_rated" to "Highest Rated",
                "most_rated" to "Most Rated",
                "four_plus" to "4+ Stars",
            )
            items(ratingOptions) { (key, label) ->
                FilterChip(
                    selected = ratingFilter == key,
                    onClick = { ratingFilter = key },
                    leadingIcon = if (key != "all") {
                        {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                modifier = Modifier.size(15.dp),
                            )
                        }
                    } else null,
                    label = { Text(label, maxLines = 1, fontSize = 12.sp) },
                )
            }
        }

        if (filtered.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        if (packages.isEmpty()) "No courses saved offline yet."
                        else "No saved courses match your search or filter.",
                        color = textSecondary,
                    )
                    if (packages.isNotEmpty()) {
                        Spacer(Modifier.height(6.dp))
                        TextButton(
                            onClick = {
                                searchQuery = ""
                                statusFilter = "all"
                                ratingFilter = "all"
                            }
                        ) {
                            Text("Reset Search & Filters", color = brandAccent)
                        }
                    }
                }
            }
        } else {
            val normalizedBase = ApiClient.normalizeConnectionUrl(serverUrl)
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 16.dp),
            ) {
                items(filtered, key = { it.courseId }) { pkg ->
                    val prog = progressMap[pkg.courseId]
                    val total = maxOf(1, pkg.course.modules.size)
                    val done = prog?.completedModuleIds?.size ?: 0
                    val status = prog?.status ?: "not_started"

                    val localBannerPath = pkg.localMediaMap[pkg.course.bannerUrl]
                    val bannerModel: Any? = when {
                        !localBannerPath.isNullOrBlank() && File(localBannerPath).exists() -> File(localBannerPath)
                        pkg.course.bannerUrl.startsWith("http") -> pkg.course.bannerUrl
                        pkg.course.bannerUrl.isNotBlank() -> "$normalizedBase${pkg.course.bannerUrl}"
                        else -> null
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = cardBg),
                        border = BorderStroke(1.dp, borderColor),
                        shape = RoundedCornerShape(18.dp),
                    ) {
                        Column {
                            if (bannerModel != null) {
                                AsyncImage(
                                    model = bannerModel,
                                    contentDescription = pkg.course.title,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxWidth().height(148.dp),
                                )
                            }
                            Column(Modifier.padding(16.dp)) {
                                Text(
                                    when (status) {
                                        "completed" -> "${pkg.course.category.uppercase()} · COMPLETED · READY TO REVIEW"
                                        "in_progress" -> "${pkg.course.category.uppercase()} · IN PROGRESS · $done / $total MODULES"
                                        else -> "${pkg.course.category.uppercase()} · NOT STARTED"
                                    },
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = if (status == "completed") {
                                        if (isDarkMode) Color(0xFF34D399) else Color(0xFF15803D)
                                    } else brandAccent,
                                    fontWeight = FontWeight.Bold,
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    pkg.course.title,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = textPrimary,
                                )
                                Spacer(Modifier.height(6.dp))
                                CourseRatingRow(
                                    course = pkg.course,
                                    isDarkMode = isDarkMode,
                                    textSecondary = textSecondary,
                                )
                                Spacer(Modifier.height(10.dp))
                                LinearProgressIndicator(
                                    progress = { done.toFloat() / total.toFloat() },
                                    color = brandAccent,
                                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)),
                                )
                                Spacer(Modifier.height(14.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = { onOpen(pkg) },
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.weight(1f).height(46.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                                    ) {
                                        Text(if (status == "not_started") "Start Course" else "Resume", maxLines = 1)
                                    }
                                    OutlinedButton(
                                        onClick = { onRateCourse(pkg.course) },
                                        shape = RoundedCornerShape(12.dp),
                                        border = BorderStroke(1.dp, borderColor),
                                        modifier = Modifier.height(46.dp),
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Star,
                                            contentDescription = "Rate",
                                            tint = if (isDarkMode) Color(0xFFFBBF24) else Color(0xFFD97706),
                                            modifier = Modifier.size(17.dp),
                                        )
                                    }
                                    OutlinedButton(
                                        onClick = { onRemove(pkg.courseId) },
                                        shape = RoundedCornerShape(12.dp),
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
}

@Composable
private fun FinishedCoursesTab(
    pending: List<PendingOfflineSubmission>,
    submitted: List<CourseSubmission>,
    isConnected: Boolean,
    isDarkMode: Boolean,
    brandAccent: Color,
    cardBg: Color,
    borderColor: Color,
    textPrimary: Color,
    textSecondary: Color,
    user: UserAccount?,
    onSubmitPending: (PendingOfflineSubmission) -> Unit,
    onRequireAuth: () -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 16.dp),
    ) {
        item {
            SectionHeaderBlock(
                kicker = "SYNC & REVIEWS",
                title = "Completed Courses",
                subtitle = "Queue offline completions and track admin review status.",
                accent = brandAccent,
                textPrimary = textPrimary,
                textSecondary = textSecondary,
            )
        }
        item {
            Text(
                "Pending Submission (Offline Queue)",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = textPrimary,
            )
        }
        if (pending.isEmpty()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = BorderStroke(1.dp, borderColor),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(
                        "No offline completions waiting to sync.",
                        style = MaterialTheme.typography.bodySmall,
                        color = textSecondary,
                        modifier = Modifier.padding(14.dp),
                    )
                }
            }
        } else {
            items(pending, key = { it.id }) { item ->
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDarkMode) Color(0xFF451A03).copy(alpha = 0.5f) else Color(0xFFFFFBEB)
                    ),
                    border = BorderStroke(
                        1.dp,
                        if (isDarkMode) Color(0xFFB45309).copy(alpha = 0.55f) else Color(0xFFFDE68A)
                    ),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(item.courseTitle, fontWeight = FontWeight.Bold, color = textPrimary)
                        Text(
                            "Score: ${item.overallScore}% · Saved offline",
                            style = MaterialTheme.typography.bodySmall,
                            color = textSecondary,
                        )
                        Spacer(Modifier.height(10.dp))
                        Button(
                            onClick = { onSubmitPending(item) },
                            enabled = isConnected,
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                            modifier = Modifier.fillMaxWidth().height(44.dp),
                        ) {
                            Text(if (!isConnected) "Connect Wi-Fi to Submit" else "Submit Now")
                        }
                    }
                }
            }
        }

        item {
            Spacer(Modifier.height(6.dp))
            Text(
                "Submitted Courses",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = textPrimary,
            )
        }
        if (user == null) {
            item {
                Button(
                    onClick = onRequireAuth,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                ) { Text("Sign In to View Submissions") }
            }
        } else if (submitted.isEmpty()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = BorderStroke(1.dp, borderColor),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(
                        "No submitted courses cached yet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = textSecondary,
                        modifier = Modifier.padding(14.dp),
                    )
                }
            }
        } else {
            items(submitted, key = { it._id }) { sub ->
                val statusColor = when (sub.status) {
                    "approved" -> if (isDarkMode) Color(0xFF34D399) else Color(0xFF15803D)
                    "rejected" -> if (isDarkMode) Color(0xFFF87171) else Color(0xFFDC2626)
                    else -> if (isDarkMode) Color(0xFFFBBF24) else Color(0xFFD97706)
                }
                val label = when (sub.status) {
                    "approved" -> "APPROVED"
                    "rejected" -> "REJECTED"
                    else -> "PENDING ADMIN REVIEW"
                }
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = BorderStroke(1.dp, borderColor),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "$label · SCORE ${sub.overallScore}%",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = statusColor,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(sub.courseTitle, fontWeight = FontWeight.Bold, color = textPrimary)
                        sub.adminFeedback?.let {
                            Spacer(Modifier.height(4.dp))
                            Text("Admin note: $it", style = MaterialTheme.typography.bodySmall, color = textSecondary)
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
    isConnected: Boolean,
    brandAccent: Color,
    cardBg: Color,
    borderColor: Color,
    textPrimary: Color,
    textSecondary: Color,
    onViewPdf: (CertificateRecord) -> Unit,
    onEmailPdf: (CertificateRecord) -> Unit,
    onRequireAuth: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        SectionHeaderBlock(
            kicker = "EARNED CREDENTIALS",
            title = "Certificates",
            subtitle = "View official PDF credentials and export or share copies offline.",
            accent = brandAccent,
            textPrimary = textPrimary,
            textSecondary = textSecondary,
        )

        if (user == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Button(
                    onClick = onRequireAuth,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                ) { Text("Sign In to View Certificates") }
            }
            return
        }
        if (certificates.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    if (isConnected) "No certificates issued yet."
                    else "No cached certificates available offline yet.",
                    color = textSecondary,
                )
            }
            return
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 16.dp),
        ) {
            items(certificates, key = { it._id }) { cert ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = BorderStroke(1.dp, borderColor),
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "${cert.issuerName.uppercase()} · ${cert.certificateCode}",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = brandAccent,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            cert.certificateTitle,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = textPrimary,
                        )
                        Text("${cert.courseTitle} · Score ${cert.score}%", style = MaterialTheme.typography.bodySmall, color = textSecondary)
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = { onViewPdf(cert) },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1f).height(46.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                            ) {
                                Text("View PDF")
                            }
                            OutlinedButton(
                                onClick = { onEmailPdf(cert) },
                                shape = RoundedCornerShape(12.dp),
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
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CoursePlayerScreen(
    pkg: DownloadedCoursePackage,
    serverUrl: String,
    initialProgress: CourseProgressState,
    isConnected: Boolean,
    isDarkMode: Boolean,
    onToggleDarkMode: () -> Unit,
    brandAccent: Color,
    user: UserAccount?,
    onProgressChange: (CourseProgressState) -> Unit,
    onSubmitOnline: suspend (Int, Boolean, Int, List<QuestionAttemptRecord>, List<QuizAttemptSummary>) -> Unit,
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
    val textPrimary = MaterialTheme.colorScheme.onBackground
    val textSecondary = MaterialTheme.colorScheme.onSurfaceVariant
    val cardBg = if (isDarkMode) Color(0xFF0B1222).copy(alpha = 0.90f) else Color.White.copy(alpha = 0.96f)
    val borderColor = MaterialTheme.colorScheme.outline

    val lessonListState = rememberLazyListState()
    LaunchedEffect(mod?.id) {
        lessonListState.scrollToItem(0)
    }

    val totalModules = maxOf(1, pkg.course.modules.size)
    val validModuleIds = remember(pkg.course.modules) { pkg.course.modules.map { it.id }.toSet() }
    val completedModulesCount = progress.completedModuleIds.count { validModuleIds.contains(it) }
    val isCurrentCompleted = mod != null && progress.completedModuleIds.contains(mod.id)

    val lessonScrollFraction by remember(lessonListState, mod?.id) {
        derivedStateOf {
            val info = lessonListState.layoutInfo
            val totalItems = info.totalItemsCount
            if (totalItems <= 0 || info.visibleItemsInfo.isEmpty()) {
                0f
            } else if (!lessonListState.canScrollForward) {
                0.85f
            } else {
                val lastVisible = info.visibleItemsInfo.last().index + 1
                ((lastVisible.toFloat() / totalItems.toFloat()) * 0.85f).coerceIn(0f, 0.85f)
            }
        }
    }

    val quizTotalQuestions = mod?.questions?.size ?: 0
    val answeredQuestions = if (mod?.kind == "quiz") {
        mod.questions.count { q ->
            when (val ans = answers[q.id]) {
                is QuizAnswerInput.SingleIndex -> true
                is QuizAnswerInput.MultiIndices -> ans.indices.isNotEmpty()
                is QuizAnswerInput.EssayText -> ans.text.isNotBlank()
                null -> false
            }
        }
    } else 0
    val quizFraction = when {
        mod?.kind != "quiz" -> 0f
        feedbackBanner?.first == true -> 1f
        quizTotalQuestions <= 0 -> 0f
        else -> ((answeredQuestions.toFloat() / quizTotalQuestions.toFloat()) * 0.85f).coerceIn(0f, 0.85f)
    }

    val currentModuleContribution = when {
        showSummary -> 0f
        isCurrentCompleted -> 0f
        mod?.kind == "lesson" -> lessonScrollFraction
        mod?.kind == "quiz" -> quizFraction
        else -> 0f
    }

    val overallProgress = if (showSummary) {
        1f
    } else {
        ((completedModulesCount.toFloat() + currentModuleContribution) / totalModules.toFloat()).coerceIn(0f, 1f)
    }
    val animatedOverallProgress by animateFloatAsState(
        targetValue = overallProgress,
        animationSpec = tween(durationMillis = 280),
        label = "course_player_progress",
    )
    val overallPercent = (overallProgress * 100f).toInt().coerceIn(0, 100)

    LaunchedEffect(mod?.id, showSummary) {
        if (!showSummary && mod?.kind == "lesson") {
            while (true) {
                delay(1000L)
                val next = progress.copy(
                    readingDurationSeconds = progress.readingDurationSeconds + 1,
                    updatedAt = Instant.now().toString(),
                )
                progress = next
                if (next.readingDurationSeconds % 5 == 0) {
                    onProgressChange(next)
                }
            }
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = if (isDarkMode) Color(0xFF060B18).copy(alpha = 0.94f)
                    else Color.White.copy(alpha = 0.94f),
                    titleContentColor = textPrimary,
                ),
                navigationIcon = {
                    IconButton(onClick = onExit) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Exit")
                    }
                },
                title = {
                    Column {
                        Text(
                            text = if (showSummary) "SUMMARY"
                            else "MODULE ${progress.currentModuleIndex + 1} OF ${pkg.course.modules.size}",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = brandAccent,
                        )
                        Text(
                            if (showSummary) "Course Summary" else mod?.title ?: pkg.course.title,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onToggleDarkMode) {
                        Icon(
                            imageVector = if (isDarkMode) Icons.Default.LightMode else Icons.Default.DarkMode,
                            contentDescription = "Toggle Dark Mode",
                            tint = if (isDarkMode) Color(0xFFFBBF24) else textPrimary,
                        )
                    }
                },
            )
        },
        bottomBar = {
            if (!showSummary) {
                Surface(
                    color = if (isDarkMode) Color(0xFF060B18).copy(alpha = 0.96f)
                    else Color.White.copy(alpha = 0.96f),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column {
                        HorizontalDivider(color = borderColor)
                        Column(
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .navigationBarsPadding()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                val statusLabel = if (mod?.kind == "quiz") {
                                    "Module ${progress.currentModuleIndex + 1} of $totalModules · Quiz $answeredQuestions/$quizTotalQuestions answered"
                                } else {
                                    "Module ${progress.currentModuleIndex + 1} of $totalModules · $completedModulesCount/$totalModules completed"
                                }
                                Text(
                                    text = statusLabel,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = textSecondary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f).padding(end = 8.dp),
                                )
                                Text(
                                    text = "$overallPercent%",
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = if (overallPercent >= 100) {
                                        if (isDarkMode) Color(0xFF34D399) else Color(0xFF15803D)
                                    } else brandAccent,
                                )
                            }
                            LinearProgressIndicator(
                                progress = { animatedOverallProgress },
                                color = if (overallPercent >= 100) {
                                    if (isDarkMode) Color(0xFF34D399) else Color(0xFF15803D)
                                } else brandAccent,
                                trackColor = if (isDarkMode) Color(0xFF1E293B) else Color(0xFFE2E8F0),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(7.dp)
                                    .clip(RoundedCornerShape(999.dp)),
                            )
                        }
                    }
                }
            }
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
                    Text(
                        "Overall Accuracy: $score%",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = textPrimary,
                    )
                }
                items(orderedResults, key = { it.questionId }) { rec ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (rec.isCorrect) {
                                if (isDarkMode) Color(0xFF064E3B).copy(alpha = 0.55f) else Color(0xFFECFDF5)
                            } else {
                                if (isDarkMode) Color(0xFF7F1D1D).copy(alpha = 0.45f) else Color(0xFFFEF2F2)
                            }
                        ),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text(rec.questionPrompt, fontWeight = FontWeight.SemiBold, color = textPrimary)
                            Text("Your answer: ${rec.userAnswerLabel} · Tries: ${rec.tries}", style = MaterialTheme.typography.bodySmall, color = textSecondary)
                            if (!rec.isCorrect) {
                                Text("Correct answer: ${rec.correctAnswerLabel}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = textPrimary)
                                Text("Explanation: ${rec.explanation}", style = MaterialTheme.typography.bodySmall, color = textSecondary)
                            }
                        }
                    }
                }
                errorText?.let { err ->
                    item { Text(err, color = Color(0xFFEF4444)) }
                }
                item {
                    if (!isConnected) {
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
                                        readingDurationSeconds = progress.readingDurationSeconds,
                                        questionResults = orderedResults,
                                        quizResults = quizList,
                                    )
                                )
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
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
                                    runCatching { onSubmitOnline(score, passed, progress.readingDurationSeconds, orderedResults, quizList) }
                                        .onFailure { errorText = it.message }
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        ) { Text("Submit Course to Admin") }
                    }
                }
            }
            return@Scaffold
        }

        if (mod == null) return@Scaffold

        val normalizedBase = ApiClient.normalizeConnectionUrl(serverUrl)

        LazyColumn(
            state = lessonListState,
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
                            color = textPrimary,
                        )
                        "body" -> Text(
                            blk.text.orEmpty(),
                            style = MaterialTheme.typography.bodyLarge,
                            color = textPrimary,
                        )
                        "bullets" -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            blk.items.forEach { bullet ->
                                Text("• $bullet", style = MaterialTheme.typography.bodyMedium, color = textPrimary)
                            }
                        }
                        "image" -> {
                            val localPath = pkg.localMediaMap[blk.url]
                            val model: Any? = if (localPath != null && File(localPath).exists()) File(localPath)
                            else blk.url?.let { if (it.startsWith("http")) it else "$normalizedBase$it" }
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
                                Uri.parse(if (u.startsWith("http")) u else "$normalizedBase$u")
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
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    ) { Text("Complete Lesson & Continue") }
                }
            } else {
                item {
                    Text(
                        "PASSING SCORE: ${mod.passingScore ?: 70}%",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = brandAccent,
                        fontWeight = FontWeight.Bold,
                    )
                }
                if (feedbackBanner != null) {
                    val (passed, msg) = feedbackBanner!!
                    item {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = if (passed) {
                                    if (isDarkMode) Color(0xFF064E3B).copy(alpha = 0.55f) else Color(0xFFECFDF5)
                                } else {
                                    if (isDarkMode) Color(0xFF7F1D1D).copy(alpha = 0.45f) else Color(0xFFFEF2F2)
                                }
                            ),
                        ) {
                            Column(Modifier.padding(16.dp)) {
                                Text(msg, fontWeight = FontWeight.Bold, color = textPrimary)
                                Spacer(Modifier.height(10.dp))
                                Button(
                                    onClick = {
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
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                                ) {
                                    Text(if (passed) "Continue" else "Apply Failure Rule & Continue")
                                }
                            }
                        }
                    }
                } else {
                    items(mod.questions, key = { it.id }) { q ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = cardBg),
                            border = BorderStroke(1.dp, borderColor),
                            shape = RoundedCornerShape(16.dp),
                        ) {
                            Column(Modifier.padding(14.dp)) {
                                Text(q.prompt, fontWeight = FontWeight.SemiBold, color = textPrimary)
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
                                                Text(opt, color = textPrimary)
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
                                                Text(opt, color = textPrimary)
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
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
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
    isConnected: Boolean,
    isDarkMode: Boolean,
    currentUser: UserAccount?,
    brandAccent: Color,
    onDismiss: () -> Unit,
    onAuthenticated: (String, UserAccount) -> Unit,
    onSignOut: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var isRegister by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val dialogBg = if (isDarkMode) Color(0xFF0F172A) else Color.White

    if (currentUser != null) {
        AlertDialog(
            onDismissRequest = onDismiss,
            containerColor = dialogBg,
            shape = RoundedCornerShape(20.dp),
            title = {
                Column {
                    Text(
                        "SIGNED IN ACCOUNT",
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = brandAccent,
                    )
                    Text(currentUser.name, fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(currentUser.email, style = MaterialTheme.typography.bodyMedium)
                    Surface(
                        color = if (isDarkMode) Color(0xFF064E3B).copy(alpha = 0.45f) else Color(0xFFECFDF5),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "Credentials saved locally. Your session remains signed in offline and online until you tap Sign Out.",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (isDarkMode) Color(0xFF6EE7B7) else Color(0xFF065F46),
                            modifier = Modifier.padding(10.dp),
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = onSignOut,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                ) { Text("Sign Out", color = Color.White) }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) { Text("Close") }
            },
        )
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = dialogBg,
        shape = RoundedCornerShape(20.dp),
        title = {
            Column {
                Text(
                    "LEARNER AUTHENTICATION",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color = brandAccent,
                )
                Text(
                    if (isRegister) "Create Learner Account" else "Sign In",
                    fontWeight = FontWeight.Bold,
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!isConnected) {
                    Surface(
                        color = if (isDarkMode) Color(0xFF451A03).copy(alpha = 0.72f) else Color(0xFFFEF3C7),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "An active server connection is required to sign in or register. Connect Wi-Fi or verify CONNECTION settings.",
                            color = if (isDarkMode) Color(0xFFFDE68A) else Color(0xFF92400E),
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(10.dp),
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = !isRegister,
                        onClick = { isRegister = false; error = null },
                        label = { Text("Sign In") },
                    )
                    FilterChip(
                        selected = isRegister,
                        onClick = { isRegister = true; error = null },
                        label = { Text("Register") },
                    )
                }
                if (isRegister) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Full Name") },
                        singleLine = true,
                        enabled = isConnected && !isLoading,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    enabled = isConnected && !isLoading,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    enabled = isConnected && !isLoading,
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(it, color = Color(0xFFEF4444), style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Button(
                enabled = isConnected && !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                onClick = {
                    if (!isConnected) {
                        error = "Active server connection required."
                        return@Button
                    }
                    isLoading = true
                    error = null
                    scope.launch {
                        runCatching {
                            if (isRegister) api.register(name.trim(), email.trim(), password)
                            else api.login(email.trim(), password)
                        }.onSuccess { res ->
                            isLoading = false
                            onAuthenticated(res.token, res.user)
                        }.onFailure { err ->
                            isLoading = false
                            error = err.message ?: "Authentication failed."
                        }
                    }
                },
            ) {
                Text(if (isLoading) "Connecting..." else if (isRegister) "Register" else "Sign In")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun CourseRatingDialog(
    course: Course,
    api: ApiClient,
    isDarkMode: Boolean,
    brandAccent: Color,
    onDismiss: () -> Unit,
    onRated: (Course) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var selectedRating by remember(course._id) { mutableIntStateOf(course.userRating ?: 5) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val dialogBg = if (isDarkMode) Color(0xFF0F172A) else Color.White
    val starActive = if (isDarkMode) Color(0xFFFBBF24) else Color(0xFFD97706)
    val starInactive = if (isDarkMode) Color(0xFF475569) else Color(0xFFCBD5E1)
    val ratingLabel = when (selectedRating) {
        1 -> "1 / 5 · Needs Improvement"
        2 -> "2 / 5 · Fair"
        3 -> "3 / 5 · Good"
        4 -> "4 / 5 · Very Good"
        else -> "5 / 5 · Excellent"
    }

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        containerColor = dialogBg,
        shape = RoundedCornerShape(20.dp),
        title = {
            Column {
                Text(
                    "COURSE RATING",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color = brandAccent,
                )
                Text(
                    course.title,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = if (course.ratingCount > 0) {
                        "Current rating: ${String.format(Locale.US, "%.1f", course.averageRating)} ★ (${course.ratingCount} ratings)"
                    } else {
                        "Be the first learner to rate this course."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Row(
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                ) {
                    (1..5).forEach { star ->
                        IconButton(
                            onClick = { selectedRating = star },
                            enabled = !submitting,
                        ) {
                            Icon(
                                imageVector = if (star <= selectedRating) Icons.Default.Star else Icons.Default.StarBorder,
                                contentDescription = "$star stars",
                                tint = if (star <= selectedRating) starActive else starInactive,
                                modifier = Modifier.size(34.dp),
                            )
                        }
                    }
                }

                Text(
                    text = ratingLabel,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = starActive,
                )

                error?.let {
                    Text(it, color = Color(0xFFEF4444), style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !submitting,
                colors = ButtonDefaults.buttonColors(containerColor = brandAccent),
                onClick = {
                    submitting = true
                    error = null
                    scope.launch {
                        runCatching { api.rateCourse(course._id, selectedRating) }
                            .onSuccess { updated ->
                                submitting = false
                                onRated(updated)
                            }
                            .onFailure { err ->
                                submitting = false
                                error = err.message ?: "Unable to save rating."
                            }
                    }
                },
            ) {
                Text(if (submitting) "Saving..." else "Submit Rating")
            }
        },
        dismissButton = {
            TextButton(
                enabled = !submitting,
                onClick = onDismiss,
            ) { Text("Cancel") }
        },
    )
}

