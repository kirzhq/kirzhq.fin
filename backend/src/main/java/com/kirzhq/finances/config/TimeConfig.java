package com.kirzhq.finances.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class TimeConfig {

    public static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    /** The container runs in UTC; "today" for forecasts and defaults must be Moscow time. */
    @Bean
    Clock clock() {
        return Clock.system(MOSCOW);
    }
}
