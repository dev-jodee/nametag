import { prisma } from '@/lib/prisma';
import { customFieldTemplateReorderSchema, validateRequest } from '@/lib/validations';
import {
  apiResponse,
  handleApiError,
  parseRequestBody,
  withAuth,
} from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(customFieldTemplateReorderSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const { ids } = validation.data;

    // Verify ownership of every id
    const owned = await prisma.customFieldTemplate.findMany({
      where: { id: { in: ids }, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return apiResponse.error('Invalid id list');
    }

    // Apply order updates atomically
    await prisma.$transaction(
      ids.map((id, idx) =>
        prisma.customFieldTemplate.update({
          where: { id },
          data: { order: idx },
        })
      )
    );

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'custom-field-templates-reorder');
  }
});
