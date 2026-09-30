const { z } = require('zod');

const requestRideSchema = z.object({
  // Either stop ids, or the free text the student typed (resolved to the
  // nearest stop by utils/stopMatcher.js).
  body: z.object({
    pickupNodeId: z.string().uuid().optional(),
    dropNodeId: z.string().uuid().optional(),
    pickupText: z.string().trim().min(1).max(120).optional(),
    dropText: z.string().trim().min(1).max(120).optional(),
    // Single exact pickup time supplied by the user.
    // The server derives window_start/window_end using MATCH_BUFFER_MINUTES.
    pickupTime: z.string().datetime({ offset: true }),
  }).refine((b) => (b.pickupNodeId || b.pickupText) && (b.dropNodeId || b.dropText), {
    message: 'Pickup and drop are required',
  }),
  query: z.any(),
  params: z.any(),
});

const matchesQuerySchema = z.object({
  body: z.any(),
  query: z.object({ rideRequestId: z.string().uuid(), kind: z.enum(['auto', 'transit']).optional() }),
  params: z.any(),
});

module.exports = { requestRideSchema, matchesQuerySchema };
