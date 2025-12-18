import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

interface PushNotificationButtonProps {
  userId?: string;
}

export function PushNotificationButton({ userId }: PushNotificationButtonProps) {
  const { toast } = useToast();
  const {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe
  } = usePushNotifications(userId);

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast({
          title: "Notifications Disabled",
          description: "You've unsubscribed from meal reminders.",
        });
      } else {
        await subscribe();
        toast({
          title: "Notifications Enabled",
          description: "You'll now receive meal reminders on this device.",
        });
      }
    } catch (error) {
      console.error('Push notification toggle error:', error);
      toast({
        title: "Error",
        description: "Failed to update notification settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!isSupported) {
    return null; // Hide button if push notifications aren't supported
  }

  return (
    <Button
      variant={isSubscribed ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={isLoading || !userId}
      className="flex items-center gap-2"
    >
      {isSubscribed ? (
        <>
          <Bell className="h-4 w-4" />
          Notifications On
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          Enable Notifications
        </>
      )}
    </Button>
  );
}