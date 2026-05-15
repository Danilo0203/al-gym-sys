'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/lib/utils';

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot='popover' {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  // Handler to prevent closing when interacting with native select dropdowns
  // This is needed because native <select> elements render their options in a
  // separate layer that Radix treats as "outside" the popover
  const handlePointerDownOutside = React.useCallback(
    (event: CustomEvent<{ originalEvent: PointerEvent }>) => {
      // Check if the interaction is with a select element or its options
      const target = event.target as HTMLElement;
      if (
        target?.closest?.('select') || 
        target?.tagName === 'OPTION' ||
        target?.tagName === 'SELECT'
      ) {
        event.preventDefault();
        return;
      }
      // Call the original handler if provided
      onPointerDownOutside?.(event);
    },
    [onPointerDownOutside]
  );

  const handleInteractOutside = React.useCallback(
    (event: CustomEvent) => {
      // Check if the interaction is with a select element
      const target = event.target as HTMLElement;
      if (
        target?.closest?.('select') || 
        target?.tagName === 'OPTION' ||
        target?.tagName === 'SELECT'
      ) {
        event.preventDefault();
        return;
      }
      // Call the original handler if provided
      onInteractOutside?.(event as Parameters<NonNullable<typeof onInteractOutside>>[0]);
    },
    [onInteractOutside]
  );

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot='popover-content'
        align={align}
        sideOffset={sideOffset}
        onPointerDownOutside={handlePointerDownOutside}
        onInteractOutside={handleInteractOutside}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot='popover-anchor' {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
