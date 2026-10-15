const { z } = require('zod');

const REPORT_CATEGORIES = ['unsafe driving', 'harassment', 'no show', 'payment issue', 'other'];

const idParam = (name) => z.object({ [name]: z.string().uuid() });

const cancelRideSchema = z.object({
  body: z.object({ reason: z.string().trim().max(200).optional() }),
  query: z.any(),
  params: idParam('groupId'),
});

const studentStatusSchema = z.object({
  body: z.object({ suspended: z.boolean(), reason: z.string().trim().max(200).optional() }),
  query: z.any(),
  params: idParam('userId'),
});

const fileReportSchema = z.object({
  body: z.object({
    aboutUserId: z.string().uuid().optional(),
    aboutPlate: z.string().trim().max(20).optional(),
    category: z.enum(REPORT_CATEGORIES),
    message: z.string().trim().min(5).max(600),
  }),
  query: z.any(),
  params: idParam('groupId'),
});

const resolveReportSchema = z.object({
  body: z.object({ status: z.enum(['resolved', 'dismissed']), resolution: z.string().trim().max(300).optional() }),
  query: z.any(),
  params: idParam('id'),
});

const noticeSchema = z.object({
  body: z.object({
    message: z.string().trim().min(3).max(300),
    level: z.enum(['info', 'warning']).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  query: z.any(),
  params: z.any(),
});

module.exports = { REPORT_CATEGORIES, cancelRideSchema, studentStatusSchema, fileReportSchema, resolveReportSchema, noticeSchema };
