const { z } = require('zod');
const { COMPLAINT_TAGS, INSPECTION_PHOTOS } = require('../../config/vehicleRules');

const plateParam = z.object({ plate: z.string().trim().min(4).max(20) });

const feedbackSchema = z.object({
  body: z.object({
    cleanliness: z.number().int().min(1).max(5),
    condition: z.number().int().min(1).max(5),
    tags: z.array(z.enum(COMPLAINT_TAGS)).max(COMPLAINT_TAGS.length).optional(),
  }),
  query: z.any(),
  params: z.object({ groupId: z.string().uuid() }),
});

const inspectionSchema = z.object({
  body: z.object({ photos: z.object(Object.fromEntries(INSPECTION_PHOTOS.map((p) => [p, z.string().trim().min(1).max(300)]))) }),
  query: z.any(),
  params: plateParam,
});

const reviewSchema = z.object({
  body: z.object({ approve: z.boolean(), note: z.string().trim().max(300).optional() }),
  query: z.any(),
  params: z.object({ id: z.string().uuid() }),
});

const serviceSchema = z.object({
  body: z.object({ servicedOn: z.string().datetime({ offset: true }).optional() }),
  query: z.any(),
  params: plateParam,
});

const documentsSchema = z.object({
  body: z.object({
    permit: z.string().datetime({ offset: true }).optional(),
    insurance: z.string().datetime({ offset: true }).optional(),
    puc: z.string().datetime({ offset: true }).optional(),
    fitness: z.string().datetime({ offset: true }).optional(),
    registrationNumber: z.string().trim().min(4).max(30).optional(),
    documentsStatus: z.enum(['approved', 'pending', 'rejected']).optional(),
  }),
  query: z.any(),
  params: plateParam,
});

const statusSchema = z.object({
  body: z.object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().max(200).optional() }),
  query: z.any(),
  params: plateParam,
});

module.exports = { feedbackSchema, inspectionSchema, reviewSchema, serviceSchema, documentsSchema, statusSchema };
