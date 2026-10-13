import { z } from 'zod';

export const channelNameSchema = z.enum(['telegram', 'whatsapp']);
export type ChannelName = z.infer<typeof channelNameSchema>;

export const updateNotificationSettingSchema = z.object({
  channel: channelNameSchema,
  enabled: z.boolean(),
  destination: z.string().trim().max(100).default(''),
});
export type UpdateNotificationSettingRequest = z.infer<typeof updateNotificationSettingSchema>;

export const testNotificationSchema = z.object({ channel: channelNameSchema });

export interface NotificationSettingResponse {
  channel: ChannelName;
  enabled: boolean;
  destination: string;
  /** False when the server has no credentials for this channel. */
  available: boolean;
}
