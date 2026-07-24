package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Vehicle;
import com.kirzhq.finances.repository.VehicleRepository;
import com.kirzhq.finances.web.dto.VehicleResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VehicleService {
    private final VehicleRepository repository;

    public VehicleService(VehicleRepository repository) {
        this.repository = repository;
    }

    public List<VehicleResponse> findAll() {
        return repository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    public Vehicle get(Long id) {
        return id == null ? null : repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Автомобиль не найден"));
    }

    private VehicleResponse toResponse(Vehicle vehicle) {
        return new VehicleResponse(vehicle.getId(), vehicle.getName());
    }
}
