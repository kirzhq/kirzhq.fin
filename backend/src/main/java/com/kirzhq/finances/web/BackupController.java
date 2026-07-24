package com.kirzhq.finances.web;

import com.kirzhq.finances.service.BackupService;
import com.kirzhq.finances.web.dto.BackupData;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/backup")
public class BackupController {
    private final BackupService backupService;

    public BackupController(BackupService backupService) {
        this.backupService = backupService;
    }

    @GetMapping("/export")
    public ResponseEntity<BackupData> exportData() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"kirzhq-fin-backup-" + LocalDate.now() + ".json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(backupService.exportData());
    }

    @PostMapping("/import")
    public Map<String, Boolean> importData(@RequestBody BackupData backup) {
        backupService.importData(backup);
        return Map.of("imported", true);
    }
}
