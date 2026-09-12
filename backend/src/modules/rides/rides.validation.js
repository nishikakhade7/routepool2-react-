const { z } = require('zod');

const requestRideSchema = z.object({
  body: z.object({
    pickupNodeId: z.string().uuid(),
    dropNodeId: z.string().uuid(),
    // Single exact pickup time supplied by the user.
    // The server derives window_start/window_end using MATCH_BUFFER_MINUTES.
    pickupTime: z.string().datetime({ offset: true }),
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
