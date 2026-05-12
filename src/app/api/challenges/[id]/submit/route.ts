import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { xpForDifficulty, streakBonus, calculateLevel, isStreakBroken } from "@/lib/gamification";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const { id } = await params;
    const body = await request.json();
    const { answer, timeSpent } = body;

    // Get challenge
    const challenge = await db.challenge.findUnique({
      where: { id },
    });

    if (!challenge) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    // Validate answer
    let isCorrect = false;

    if (challenge.validationType === "static") {
      const correctAnswer = JSON.parse(challenge.correctAnswer);
      if (challenge.type === "multiple_choice") {
        isCorrect = answer === correctAnswer;
      } else if (challenge.type === "ordering" || challenge.type === "workflow_build") {
        const userAnswer = Array.isArray(answer) ? answer : JSON.parse(answer);
        isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
      } else {
        // text_input, prompt_fix
        isCorrect = answer.trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      }
    } else if (challenge.validationType === "pattern") {
      const config = challenge.validationConfig ? JSON.parse(challenge.validationConfig) : {};
      const keywords: string[] = config.keywords || [];
      if (keywords.length > 0) {
        const answerLower = answer.toLowerCase();
        isCorrect = keywords.every((kw: string) => answerLower.includes(kw.toLowerCase()));
      }
    }

    // Calculate XP
    const baseXp = xpForDifficulty(challenge.difficulty);
    const xpEarned = isCorrect ? baseXp : 0;

    // Create attempt
    const attempt = await db.challengeAttempt.create({
      data: {
        userId,
        challengeId: id,
        answer: JSON.stringify(answer),
        isCorrect,
        xpEarned,
        timeSpent: timeSpent || null,
      },
    });

    // If correct, award XP and update user
    if (isCorrect) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user) {
        const newXp = user.xp + xpEarned;
        const newLevel = calculateLevel(newXp);

        // Check streak
        let newStreak = user.streak;
        const broken = isStreakBroken(user.lastActiveAt);
        if (broken) {
          newStreak = 1;
        } else {
          // Check if already completed something today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayAttempts = await db.challengeAttempt.count({
            where: {
              userId,
              isCorrect: true,
              createdAt: { gte: todayStart },
            },
          });
          if (todayAttempts <= 1) {
            newStreak = user.streak + 1;
          }
        }

        const bonusXp = streakBonus(newStreak);
        const totalXpEarned = xpEarned + bonusXp;
        const finalXp = newXp + bonusXp;
        const finalLevel = calculateLevel(finalXp);
        const maxStreak = Math.max(user.maxStreak, newStreak);

        await db.user.update({
          where: { id: userId },
          data: {
            xp: finalXp,
            level: finalLevel,
            streak: newStreak,
            maxStreak,
            lastActiveAt: new Date(),
          },
        });

        // XP log
        await db.xPLog.create({
          data: {
            userId,
            amount: xpEarned,
            reason: "challenge",
            referenceId: id,
          },
        });

        if (bonusXp > 0) {
          await db.xPLog.create({
            data: {
              userId,
              amount: bonusXp,
              reason: "streak_bonus",
            },
          });
        }

        // Mark daily challenge as completed if applicable
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await db.dailyChallengeAssignment.updateMany({
          where: {
            userId,
            challengeId: id,
            date: { gte: today },
            completed: false,
          },
          data: {
            completed: true,
            completedAt: new Date(),
          },
        });

        // Update user skill XP if challenge has a skill
        if (challenge.skillId) {
          const existingSkill = await db.userSkill.findUnique({
            where: { userId_skillId: { userId, skillId: challenge.skillId } },
          });
          if (existingSkill) {
            await db.userSkill.update({
              where: { id: existingSkill.id },
              data: { xp: existingSkill.xp + xpEarned },
            });
          } else {
            await db.userSkill.create({
              data: {
                userId,
                skillId: challenge.skillId,
                xp: xpEarned,
              },
            });
          }
        }

        // Check achievements
        const totalCorrect = await db.challengeAttempt.count({
          where: { userId, isCorrect: true },
        });

        const achievementConditions = [
          { slug: "first-challenge", check: totalCorrect >= 1 },
          { slug: "10-challenges", check: totalCorrect >= 10 },
          { slug: "50-challenges", check: totalCorrect >= 50 },
          { slug: "7-day-streak", check: newStreak >= 7 },
          { slug: "30-day-streak", check: newStreak >= 30 },
        ];

        for (const cond of achievementConditions) {
          if (cond.check) {
            const achievement = await db.achievement.findUnique({
              where: { slug: cond.slug },
            });
            if (achievement) {
              const existing = await db.userAchievement.findUnique({
                where: {
                  userId_achievementId: {
                    userId,
                    achievementId: achievement.id,
                  },
                },
              });
              if (!existing) {
                await db.userAchievement.create({
                  data: { userId, achievementId: achievement.id },
                });
                if (achievement.xpReward > 0) {
                  await db.user.update({
                    where: { id: userId },
                    data: { xp: { increment: achievement.xpReward } },
                  });
                  await db.xPLog.create({
                    data: {
                      userId,
                      amount: achievement.xpReward,
                      reason: "achievement",
                      referenceId: achievement.id,
                    },
                  });
                }
              }
            }
          }
        }

        return NextResponse.json({
          isCorrect,
          xpEarned: totalXpEarned,
          baseXp,
          bonusXp,
          explanation: challenge.explanation,
          newLevel: finalLevel,
          newStreak,
          leveledUp: finalLevel > user.level,
        });
      }
    }

    return NextResponse.json({
      isCorrect,
      xpEarned: 0,
      baseXp,
      bonusXp: 0,
      explanation: challenge.explanation,
      newLevel: (session.user as Record<string, unknown>).level as number,
      newStreak: (session.user as Record<string, unknown>).streak as number,
      leveledUp: false,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
