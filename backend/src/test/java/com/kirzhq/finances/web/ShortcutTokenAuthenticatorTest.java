package com.kirzhq.finances.web;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ShortcutTokenAuthenticatorTest {

    @Test
    void acceptsMatchingBearerToken() {
        ShortcutTokenAuthenticator authenticator = new ShortcutTokenAuthenticator("secret-token");
        assertDoesNotThrow(() -> authenticator.authenticate("Bearer secret-token"));
    }

    @Test
    void rejectsMissingInvalidAndDisabledTokens() {
        ShortcutTokenAuthenticator authenticator = new ShortcutTokenAuthenticator("secret-token");
        assertThrows(ResponseStatusException.class, () -> authenticator.authenticate(null));
        assertThrows(ResponseStatusException.class, () -> authenticator.authenticate("Bearer wrong"));
        assertThrows(ResponseStatusException.class,
                () -> new ShortcutTokenAuthenticator("").authenticate("Bearer secret-token"));
    }
}
