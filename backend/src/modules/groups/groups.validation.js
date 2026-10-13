const { z } = require('zod');

const joinGroupSchema = z.object({
  body: z.object({
    rideRequestId: z.string().uuid(),
    memberRideRequestIds: z.array(z.string().uuid()).min(1),
    kind: z.enum(['auto', 'transit']).optional(), // 1 = first rider starting a group
    // "Show other groups for this ride": ignore my own women-only preference once.
    relaxPreference: z.boolean().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

const groupIdParamSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({ groupId: z.string().uuid() }),
});

const postMessageSchema = z.object({
  body: z.object({ message: z.string().trim().min(1).max(1000) }),
  query: z.any(),
  params: z.object({ groupId: z.string().uuid() }),
});

const setMeetingSchema = z.object({
  body: z.object({
    meetingPoint: z.string().trim().max(120).optional(),
    transitMode: z.enum(['bus', 'train', 'metro', 'walk', 'other']).optional(),
  }),
  query: z.any(),
  params: z.object({ groupId: z.string().uuid() }),
});

const boardSchema = z.object({
  body: z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Rider code is 6 digits') }),
  query: z.any(),
  params: z.object({ groupId: z.string().uuid() }),
});

// "Allow any driver" for this ride (waives only the caller's own preference).
const driverPreferenceSchema = z.object({
  body: z.object({ allowAnyDriver: z.boolean() }),
  query: z.any(),
  params: z.object({ groupId: z.string().uuid() }),
});

// Payment step completed (no real gateway): which method the rider chose.
const paySchema = z.object({
  body: z.object({ method: z.enum(['upi', 'wallet', 'card', 'cash']) }),
  query: z.any(),
  params: z.object({ groupId: z.string().uuid() }),
});

module.exports = { paySchema, boardSchema, setMeetingSchema, joinGroupSchema, groupIdParamSchema, postMessageSchema, driverPreferenceSchema };
