const { z } = require('zod');

const joinGroupSchema = z.object({
  body: z.object({
    rideRequestId: z.string().uuid(),
    memberRideRequestIds: z.array(z.string().uuid()).min(1),
    kind: z.enum(['auto', 'transit']).optional(), // 1 = first rider starting a group
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

module.exports = { boardSchema, setMeetingSchema, joinGroupSchema, groupIdParamSchema, postMessageSchema };
