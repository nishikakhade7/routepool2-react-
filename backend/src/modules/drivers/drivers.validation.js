const { z } = require('zod');

const shape = (body, params = z.any()) => z.object({ body, query: z.any(), params });
const groupParams = z.object({ groupId: z.string().uuid() });

const sendOtpSchema = shape(z.object({ email: z.string().trim().toLowerCase() }));
const verifyOtpSchema = shape(z.object({
  email: z.string().trim().toLowerCase(),
  code: z.string().regex(/^\d{4}$/, 'Code must be a 4-digit number'),
}));
const vehicleSchema = shape(z.object({
  model: z.string().trim().min(2, 'Enter the vehicle model').max(60),
  colour: z.string().trim().min(2, 'Enter the colour').max(30),
  seats: z.number().int().min(1).max(6),
}));
const availabilitySchema = shape(z.object({ online: z.boolean() }));
const groupSchema = shape(z.any(), groupParams);
const boardSchema = shape(z.object({ code: z.string().regex(/^\d{6}$/, 'Rider codes are 6 digits') }), groupParams);
const ageSchema = shape(z.object({ days: z.number().int().min(1).max(400) }));
const reviewSchema = shape(z.object({ approve: z.boolean(), note: z.string().max(200).optional() }), z.object({ id: z.string().uuid() }));

module.exports = { sendOtpSchema, verifyOtpSchema, vehicleSchema, availabilitySchema, groupSchema, boardSchema, ageSchema, reviewSchema };
