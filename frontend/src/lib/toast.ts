import { toast as sonnerToast, ExternalToast } from "sonner";
import type { ReactNode } from "react";
import en from "@/dictionaries/en.json";
import es from "@/dictionaries/es.json";

type ToastMessage = ReactNode | (() => ReactNode);

function getLocale(): "en" | "es" {
  if (typeof window === "undefined") return "es";
  const stored = localStorage.getItem("locale");
  return stored === "en" ? "en" : "es";
}

function translateMessage(message: ToastMessage): ToastMessage {
  if (typeof message !== "string") return message;

  const locale = getLocale();
  const dict = locale === "en" ? en : es;

  const parts = message.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }
  if (typeof current === "string") return current;

  if (dict.toasts && message in dict.toasts) {
    return (dict.toasts as Record<string, string>)[message];
  }

  return message;
}

const toastFunction = (message: ToastMessage, options?: ExternalToast) => {
  return sonnerToast(translateMessage(message), options);
};

toastFunction.success = (message: ToastMessage, options?: ExternalToast) => {
  return sonnerToast.success(translateMessage(message), options);
};

toastFunction.error = (message: ToastMessage, options?: ExternalToast) => {
  return sonnerToast.error(translateMessage(message), options);
};

toastFunction.loading = (message: ToastMessage, options?: ExternalToast) => {
  return sonnerToast.loading(translateMessage(message), options);
};

toastFunction.info = (message: ToastMessage, options?: ExternalToast) => {
  return sonnerToast.info(translateMessage(message), options);
};

toastFunction.warning = (message: ToastMessage, options?: ExternalToast) => {
  return sonnerToast.warning(translateMessage(message), options);
};

toastFunction.dismiss = (id?: string | number) => {
  return sonnerToast.dismiss(id);
};

export const toast = toastFunction;
