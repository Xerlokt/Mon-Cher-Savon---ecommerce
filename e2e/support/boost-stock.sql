UPDATE "Product" SET stock = 50 WHERE slug <> 'sabonete-de-mel';
INSERT INTO "NotificationSetting" (channel, enabled, destination) VALUES ('telegram', true, '987654321')
ON CONFLICT (channel) DO UPDATE SET enabled = true, destination = '987654321';
