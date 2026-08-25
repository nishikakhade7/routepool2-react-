const { z } = require('zod');

const sendOtpSchema = z.object({
  body: z.object({ email: z.string().email() }),
  query: z.any(),
  params: z.any(),
});

const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{4}$/, 'Code must be a 4-digit number'),
  }),
  query: z.any(),
  params: z.any(),
});

module.exports = { sendOtpSchema, verifyOtpSchema };
