const { z } = require('zod');

const joinGroupSchema = z.object({
  body: z.object({
    rideRequestId: z.string().uuid(),
    memberRideRequestIds: z.array(z.string().uuid()).min(2),
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

module.exports = { joinGroupSchema, groupIdParamSchema, postMessageSchema };
