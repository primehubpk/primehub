package com.primehub.socialai;

// Fixed-function owner-approved DIAGNOSTIC IPC.
// No arbitrary shell, app control, screen capture or background service exposed.
interface IShizukuProbe {
    int getEffectiveUid() = 1;
    String inspectDisplayService() = 2;
    void destroy() = 16777114;
}
