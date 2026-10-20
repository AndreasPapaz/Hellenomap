import { z } from "zod";
import { submissionSchema } from "./submission-schema";

export const adminEditSchema = submissionSchema
  .pick({ name: true, categories: true, address: true, phone: true, website: true, description: true })
  .extend({
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
  });

export type AdminEditInput = z.input<typeof adminEditSchema>;
export type AdminEdit = z.output<typeof adminEditSchema>;

export const reasonSchema = z.string().trim().max(500).optional();
