package com.kirzhq.finances.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class ShortcutTokenAuthenticator {

    private final byte[] expectedToken;

    public ShortcutTokenAuthenticator(@Value("${app.shortcut.token:}") String token) {
        this.expectedToken = token.getBytes(StandardCharsets.UTF_8);
    }

    public void authenticate(String authorization) {
        if (expectedToken.length == 0 || authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        byte[] suppliedToken = authorization.substring(7).getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expectedToken, suppliedToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
    }
}
