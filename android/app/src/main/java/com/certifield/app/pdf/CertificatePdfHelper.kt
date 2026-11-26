package com.certifield.app.pdf

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.certifield.app.model.CertificateElement
import com.certifield.app.model.CertificateRecord
import java.io.File
import java.io.FileOutputStream

object CertificatePdfHelper {

    private fun parseHex(hex: String?, fallback: Int): Int {
        if (hex.isNullOrBlank()) return fallback
        return try {
            Color.parseColor(hex.trim())
        } catch (_: IllegalArgumentException) {
            fallback
        }
    }

    private fun resolveText(el: CertificateElement, cert: CertificateRecord): String {
        val raw = el.text
        if (el.kind == "learner_name" && !raw.contains("{{")) {
            return cert.userName
        }
        return raw
            .replace("{{learner_name}}", cert.userName)
            .replace("{{course_title}}", cert.courseTitle)
            .replace("{{certificate_title}}", cert.certificateTitle)
            .replace("{{issuer_name}}", cert.issuerName)
            .replace("{{score}}", cert.score.toString())
            .replace("{{issue_date}}", cert.issuedAt.take(10))
            .replace("{{certificate_code}}", cert.certificateCode)
    }

    fun generatePdfFile(context: Context, cert: CertificateRecord): File {
        val dir = File(context.cacheDir, "certificates").apply { mkdirs() }
        val file = File(dir, "${cert.certificateCode}.pdf")

        // A4 landscape in points (842 x 595)
        val width = 842f
        val height = 595f
        val doc = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(842, 595, 1).create()
        val page = doc.startPage(pageInfo)
        val canvas = page.canvas

        val design = cert.certificateDesign
        if (design != null && design.elements.isNotEmpty()) {
            canvas.drawColor(parseHex(design.canvasBackground, Color.WHITE))

            val accentInt = parseHex(design.accentColor, Color.rgb(29, 78, 216))
            if (design.showBorder) {
                val outerBorder = Paint().apply {
                    style = Paint.Style.STROKE
                    strokeWidth = 3f
                    color = parseHex(design.borderColor, Color.rgb(15, 23, 42))
                }
                canvas.drawRect(28f, 28f, width - 28f, height - 28f, outerBorder)

                val innerBorder = Paint().apply {
                    style = Paint.Style.STROKE
                    strokeWidth = 1f
                    color = accentInt
                }
                canvas.drawRect(38f, 38f, width - 38f, height - 38f, innerBorder)
            }

            for (el in design.elements) {
                if (!el.visible) continue
                val x = (el.xPct.coerceIn(0f, 100f) / 100f) * width
                val y = (el.yPct.coerceIn(0f, 100f) / 100f) * height

                if (el.kind == "system_icon") {
                    val radius = (el.fontSize * 0.55f).coerceIn(14f, 34f)
                    val sealPaint = Paint().apply {
                        isAntiAlias = true
                        color = accentInt
                    }
                    canvas.drawCircle(x, y, radius, sealPaint)
                    val monoPaint = Paint().apply {
                        isAntiAlias = true
                        color = Color.WHITE
                        textAlign = Paint.Align.CENTER
                        textSize = (radius * 0.7f).coerceAtLeast(10f)
                        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                    }
                    val initial = cert.issuerName.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "C"
                    canvas.drawText(initial, x, y + radius * 0.25f, monoPaint)
                    continue
                }

                val text = resolveText(el, cert)
                if (text.isBlank()) continue

                val family = when (el.fontFamily) {
                    "serif" -> Typeface.SERIF
                    "mono" -> Typeface.MONOSPACE
                    else -> Typeface.SANS_SERIF
                }
                val style = if (el.fontWeight == "bold") Typeface.BOLD else Typeface.NORMAL
                val align = when (el.align) {
                    "left" -> Paint.Align.LEFT
                    "right" -> Paint.Align.RIGHT
                    else -> Paint.Align.CENTER
                }

                val textPaint = Paint().apply {
                    isAntiAlias = true
                    color = parseHex(el.color, Color.rgb(15, 23, 42))
                    textSize = el.fontSize.coerceIn(7f, 64f)
                    textAlign = align
                    typeface = Typeface.create(family, style)
                }
                canvas.drawText(text, x, y, textPaint)
            }
        } else {
            canvas.drawColor(Color.rgb(248, 250, 252))

            val outerBorder = Paint().apply {
                style = Paint.Style.STROKE
                strokeWidth = 3f
                color = Color.rgb(15, 23, 42)
            }
            canvas.drawRect(28f, 28f, 814f, 567f, outerBorder)

            val innerBorder = Paint().apply {
                style = Paint.Style.STROKE
                strokeWidth = 1f
                color = Color.rgb(29, 78, 216)
            }
            canvas.drawRect(38f, 38f, 804f, 557f, innerBorder)

            val centerPaint = Paint().apply {
                textAlign = Paint.Align.CENTER
                isAntiAlias = true
            }

            centerPaint.color = Color.rgb(29, 78, 216)
            centerPaint.textSize = 14f
            centerPaint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            canvas.drawText(cert.issuerName.uppercase(), 421f, 96f, centerPaint)

            centerPaint.color = Color.rgb(15, 23, 42)
            centerPaint.textSize = 34f
            centerPaint.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
            canvas.drawText("Certificate of Completion", 421f, 150f, centerPaint)

            centerPaint.color = Color.rgb(71, 85, 105)
            centerPaint.textSize = 13f
            centerPaint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
            canvas.drawText("THIS CERTIFIES THAT", 421f, 198f, centerPaint)

            centerPaint.color = Color.rgb(15, 23, 42)
            centerPaint.textSize = 30f
            centerPaint.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
            canvas.drawText(cert.userName, 421f, 244f, centerPaint)

            centerPaint.color = Color.rgb(51, 65, 85)
            centerPaint.textSize = 14f
            centerPaint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
            canvas.drawText("has successfully completed all lessons and assessments for", 421f, 294f, centerPaint)

            centerPaint.color = Color.rgb(29, 78, 216)
            centerPaint.textSize = 20f
            centerPaint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            canvas.drawText(cert.certificateTitle, 421f, 332f, centerPaint)

            centerPaint.color = Color.rgb(71, 85, 105)
            centerPaint.textSize = 13f
            centerPaint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
            canvas.drawText("Course: ${cert.courseTitle}  ·  Score: ${cert.score}%", 421f, 362f, centerPaint)

            centerPaint.color = Color.rgb(15, 23, 42)
            centerPaint.textSize = 12f
            centerPaint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            canvas.drawText(cert.issuedAt.take(10), 190f, 498f, centerPaint)
            canvas.drawText(cert.certificateCode, 652f, 498f, centerPaint)

            centerPaint.color = Color.rgb(100, 116, 139)
            centerPaint.textSize = 10f
            centerPaint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
            canvas.drawText("Date Issued", 190f, 514f, centerPaint)
            canvas.drawText("Verification ID", 652f, 514f, centerPaint)
        }

        doc.finishPage(page)
        FileOutputStream(file).use { doc.writeTo(it) }
        doc.close()
        return file
    }

    fun openPdf(context: Context, cert: CertificateRecord) {
        val file = generatePdfFile(context, cert)
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Open Certificate PDF"))
    }

    fun emailPdf(context: Context, cert: CertificateRecord) {
        val file = generatePdfFile(context, cert)
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_EMAIL, arrayOf(cert.userEmail))
            putExtra(Intent.EXTRA_SUBJECT, "Certificate: ${cert.certificateTitle} (${cert.certificateCode})")
            putExtra(
                Intent.EXTRA_TEXT,
                "Attached is your official PDF certificate for ${cert.courseTitle} (${cert.score}%).",
            )
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Email Certificate PDF"))
    }
}
