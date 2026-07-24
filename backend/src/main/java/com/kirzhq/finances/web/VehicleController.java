package com.kirzhq.finances.web;

import com.kirzhq.finances.service.VehicleService;
import com.kirzhq.finances.web.dto.VehicleResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {
    private final VehicleService service;

    public VehicleController(VehicleService service) {
        this.service = service;
    }

    @GetMapping
    public List<VehicleResponse> findAll() {
        return service.findAll();
    }
}
