import { useMutation, useQuery } from "@tanstack/react-query";
import { get, post, put } from "@/lib/api";

export function useGetUserPhone(userId: string) {
  return useQuery({
    queryKey: ["user", userId, "phone"],
    queryFn: () => get(`/api/users/${userId}/phone`)
  });
}

export function useRequestPhoneCode(userId: string) {
  return useMutation({
    mutationFn: (phoneRaw: string) =>
      post(`/api/users/${userId}/phone/request-code`, { phone: phoneRaw })
  });
}

export function useVerifyPhoneCode(userId: string) {
  return useMutation({
    mutationFn: ({ code }: { code: string }) =>
      post(`/api/users/${userId}/phone/verify`, { code })
  });
}

export function useSetSmsConsent(userId: string) {
  return useMutation({
    mutationFn: (consent: boolean) =>
      put(`/api/users/${userId}/sms-consent`, { consent })
  });
}