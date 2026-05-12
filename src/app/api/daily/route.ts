import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStreakBroken } from "@/lib/gamification";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    // Check streak
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user && isStreakBroken(user.lastActiveAt) && user.streak > 0) {
      await db.user.update({
        where: { id: userId },
        data: { streak: 0 },
      });
    }

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if daily assignment exists
    let assignment = await db.dailyChallengeAssignment.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            type: true,
            category: true,
            xpReward: true,
          },
        },
      },
    });

    // If no assignment for today, create one
    if (!assignment) {
      // Get a random active challenge that user hasn't completed today
      const completedToday = await db.challengeAttempt.findMany({
        where: {
          userId,
          isCorrect: true,
          createdAt: { gte: today, lt: tomorrow },
        },
        select: { challengeId: true },
      });

      const completedIds = completedToday.map((a) => a.challengeId);

      const availableChallenges = await db.challenge.findMany({
        where: {
          isActive: true,
          id: { notIn: completedIds.length > 0 ? completedIds : undefined },
        },
        select: { id: true },
      });

      if (availableChallenges.length === 0) {
        return NextResponse.json({
          assignmentId: null,
          challengeId: null,
          completed: false,
          completedAt: null,
          challenge: null,
        });
      }

      const randomIndex = Math.floor(Math.random() * availableChallenges.length);
      const randomChallengeId = availableChallenges[randomIndex].id;

      assignment = await db.dailyChallengeAssignment.create({
        data: {
          userId,
          challengeId: randomChallengeId,
          date: today,
        },
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              description: true,
              difficulty: true,
              type: true,
              category: true,
              xpReward: true,
            },
          },
        },
      });
    }

    return NextResponse.json({
      assignmentId: assignment.id,
      challengeId: assignment.challengeId,
      completed: assignment.completed,
      completedAt: assignment.completedAt,
      challenge: assignment.challenge,
    });
  } catch (error) {
    console.error("Daily challenge error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
