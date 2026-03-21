import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createEventSchema, updateEventSchema } from '@/lib/validations';

export type EventInput = z.infer<typeof createEventSchema>;
export type EventUpdateInput = z.infer<typeof updateEventSchema>;

const eventInclude = {
  people: {
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      surname: true,
      nickname: true,
      photo: true,
    },
  },
} as const;

export async function createEvent(userId: string, data: EventInput) {
  return prisma.event.create({
    data: {
      userId,
      title: data.title,
      date: new Date(data.date),
      people: {
        connect: data.personIds.map((id) => ({ id })),
      },
    },
    include: eventInclude,
  });
}

export async function getEvents(userId: string) {
  return prisma.event.findMany({
    where: { userId },
    include: eventInclude,
    orderBy: { date: 'asc' },
  });
}

export async function getEventsForPerson(userId: string, personId: string) {
  return prisma.event.findMany({
    where: {
      userId,
      people: { some: { id: personId } },
    },
    include: eventInclude,
    orderBy: { date: 'asc' },
  });
}

export async function getEvent(userId: string, id: string) {
  return prisma.event.findUnique({
    where: { id, userId },
    include: eventInclude,
  });
}

export async function updateEvent(userId: string, id: string, data: EventUpdateInput) {
  // Verify ownership
  const existing = await prisma.event.findUnique({ where: { id, userId } });
  if (!existing) return null;

  return prisma.event.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.personIds !== undefined && {
        people: {
          set: data.personIds.map((pid) => ({ id: pid })),
        },
      }),
    },
    include: eventInclude,
  });
}

export async function deleteEvent(userId: string, id: string) {
  const existing = await prisma.event.findUnique({ where: { id, userId } });
  if (!existing) return null;
  return prisma.event.delete({ where: { id } });
}
