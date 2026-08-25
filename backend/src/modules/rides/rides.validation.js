const { z } = require('zod');

const requestRideSchema = z.object({
  body: z.object({
    pickupNodeId: z.string().uuid(),
    dropNodeId: z.string().uuid(),
    windowStart: z.string().datetime({ offset: true }),
    windowEnd: z.string().datetime({ offset: true }),
    flexMinutes: z.number().int().min(0).max(60).default(10),
  }),
  query: z.any(),
  params: z.any(),
});

const matchesQuerySchema = z.object({
  body: z.any(),
  query: z.object({ rideRequestId: z.string().uuid() }),
  params: z.any(),
});

module.exports = { requestRideSchema, matchesQuerySchema };
