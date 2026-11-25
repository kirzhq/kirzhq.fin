package com.kirzhq.finances.domain;

/** MONTHLY repeats on the same day every month; ONCE is paid one time, its date may be unknown. */
public enum RequiredPaymentKind {
    MONTHLY,
    ONCE
}
