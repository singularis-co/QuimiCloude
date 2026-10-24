'use client';

import { ArrowLeft, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';

import { ChatMediaImage } from './chat-media-image';
import { CHAT_IMAGE_TEXT, CHAT_IMAGE_VIEWER_TESTID } from './contact-texts';

export type ChatImageViewerProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly src: string;
  readonly caption: string | null;
  readonly customerName: string;
  /** Hora del mensaje ya formateada. */
  readonly time: string;
  readonly failed: boolean;
  readonly onError: () => void;
};

export function ChatImageViewer({ open, onOpenChange, src, caption, customerName, time, failed, onError }: ChatImageViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-testid={CHAT_IMAGE_VIEWER_TESTID}
        className="top-0 left-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black/90 p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{CHAT_IMAGE_TEXT.viewerTitle(customerName)}</DialogTitle>
        <div className="flex items-center gap-2 px-1 py-2 md:justify-between md:px-6 md:pt-5">
          <DialogClose
            render={<Button variant="ghost" size="icon" touch className="text-inherit hover:bg-white/10 hover:text-inherit md:order-last" />}
            aria-label={CHAT_IMAGE_TEXT.close}
          >
            <ArrowLeft aria-hidden="true" className="md:hidden" />
            <X aria-hidden="true" className="hidden md:block" />
          </DialogClose>
          <div className="flex min-w-0 flex-col md:flex-row md:gap-1">
            <span className="truncate text-sm font-semibold md:font-normal">{customerName}</span>
            <span aria-hidden="true" className="hidden text-sm md:inline">
              ·
            </span>
            <span className="text-xs opacity-75 md:text-sm md:opacity-100">{time}</span>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-3 md:p-10">
          <ChatMediaImage kind="image" src={src} caption={caption} failed={failed} onError={onError} size="full" />
        </div>
        {caption !== null && (
          <p className="m-0 px-4 pt-4 pb-7 text-center text-[15px] [overflow-wrap:anywhere]">{caption}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
