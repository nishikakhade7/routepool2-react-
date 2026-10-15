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

const { GENDERS, DRIVER_PREFERENCES } = require('../../utils/genderRules');

// Every field optional: gender null = prefer not to say.
const preferencesSchema = z.object({
  body: z.object({
    gender: z.enum(GENDERS).nullable().optional(),
    womenOnlyGroups: z.boolean().optional(),
    driverPreference: z.enum(DRIVER_PREFERENCES).optional(),
  }),
  query: z.any(),
  params: z.any(),
});

const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(200),
  }),
  query: z.any(),
  params: z.any(),
});

module.exports = { adminLoginSchema, sendOtpSchema, verifyOtpSchema, preferencesSchema };
