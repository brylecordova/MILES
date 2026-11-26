package com.certifield.app.data

import com.certifield.app.model.CourseModule
import com.certifield.app.model.QuestionAttemptRecord
import com.certifield.app.model.QuizQuestion
import kotlin.math.ceil
import kotlin.math.roundToInt

sealed interface QuizAnswerInput {
    data class SingleIndex(val index: Int) : QuizAnswerInput
    data class MultiIndices(val indices: Set<Int>) : QuizAnswerInput
    data class EssayText(val text: String) : QuizAnswerInput
}

data class QuizEvalOutput(
    val score: Int,
    val passed: Boolean,
    val records: List<QuestionAttemptRecord>,
    val updatedTries: Map<String, Int>,
)

object QuizEngine {

    fun evaluateQuiz(
        quiz: CourseModule,
        answers: Map<String, QuizAnswerInput>,
        existingTries: Map<String, Int>,
    ): QuizEvalOutput {
        val nextTries = existingTries.toMutableMap()
        val records = mutableListOf<QuestionAttemptRecord>()
        var correctCount = 0

        for (q in quiz.questions) {
            val tries = (nextTries[q.id] ?: 0) + 1
            nextTries[q.id] = tries

            val answer = answers[q.id]
            val eval = evaluateQuestion(q, answer, quiz.passingRule == "require_manual_review")
            if (eval.isCorrect) correctCount += 1

            records += QuestionAttemptRecord(
                questionId = q.id,
                quizId = quiz.id,
                quizTitle = quiz.title,
                questionPrompt = q.prompt,
                questionType = q.type,
                topicTag = q.topicTag?.takeIf { it.isNotBlank() } ?: quiz.title,
                tries = tries,
                userAnswerLabel = eval.userLabel,
                correctAnswerLabel = eval.correctLabel,
                isCorrect = eval.isCorrect,
                needsManualReview = eval.needsManualReview,
                explanation = q.explanation,
            )
        }

        val total = quiz.questions.size
        val score = if (total == 0) 100 else ((correctCount.toDouble() / total) * 100.0).roundToInt()
        val passingScore = quiz.passingScore ?: 70
        return QuizEvalOutput(
            score = score,
            passed = score >= passingScore,
            records = records,
            updatedTries = nextTries,
        )
    }

    private data class SingleEval(
        val isCorrect: Boolean,
        val needsManualReview: Boolean,
        val userLabel: String,
        val correctLabel: String,
    )

    private fun evaluateQuestion(
        q: QuizQuestion,
        answer: QuizAnswerInput?,
        manualReview: Boolean,
    ): SingleEval {
        return when (q.type) {
            "multiple_choice", "true_false" -> {
                val opts = if (q.type == "true_false") listOf("True", "False") else q.options
                val selected = (answer as? QuizAnswerInput.SingleIndex)?.index ?: -1
                val expected = q.correctIndex ?: 0
                SingleEval(
                    isCorrect = selected == expected,
                    needsManualReview = false,
                    userLabel = opts.getOrNull(selected) ?: "No answer selected",
                    correctLabel = opts.getOrNull(expected) ?: "Unconfigured",
                )
            }

            "select_all" -> {
                val selected = (answer as? QuizAnswerInput.MultiIndices)?.indices?.sorted() ?: emptyList()
                val expected = q.correctIndices.distinct().sorted()
                val isCorrect = expected.isNotEmpty() && selected == expected
                SingleEval(
                    isCorrect = isCorrect,
                    needsManualReview = false,
                    userLabel = if (selected.isEmpty()) "No options selected"
                    else selected.mapNotNull { q.options.getOrNull(it) }.joinToString(", "),
                    correctLabel = if (expected.isEmpty()) "Unconfigured"
                    else expected.mapNotNull { q.options.getOrNull(it) }.joinToString(", "),
                )
            }

            else -> {
                val text = (answer as? QuizAnswerInput.EssayText)?.text?.trim().orEmpty()
                val keywords = q.essayRubricKeywords.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
                val isCorrect = if (text.isEmpty()) {
                    false
                } else if (keywords.isNotEmpty()) {
                    val lower = text.lowercase()
                    val matched = keywords.count { lower.contains(it) }
                    matched >= maxOf(1, ceil(keywords.size * 0.5).toInt())
                } else {
                    text.length >= 15
                }
                SingleEval(
                    isCorrect = isCorrect,
                    needsManualReview = manualReview || keywords.isEmpty(),
                    userLabel = text.ifEmpty { "No response submitted" },
                    correctLabel = q.modelAnswer?.takeIf { it.isNotBlank() }
                        ?: "Key concepts: ${keywords.joinToString(", ")}",
                )
            }
        }
    }

    fun getRestartTargetIndex(
        modules: List<CourseModule>,
        failedQuizIndex: Int,
        failureRule: String?,
    ): Int {
        if (modules.isEmpty()) return 0
        val safeIdx = failedQuizIndex.coerceIn(0, modules.lastIndex)
        return when (failureRule) {
            "restart_course" -> 0
            "restart_since_last_quiz" -> {
                var target = 0
                for (i in (safeIdx - 1) downTo 0) {
                    if (modules[i].kind == "quiz") {
                        target = minOf(i + 1, safeIdx)
                        break
                    }
                }
                target
            }
            else -> safeIdx
        }
    }
}
