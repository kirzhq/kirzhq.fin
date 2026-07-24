package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VehicleRepository extends JpaRepository<Vehicle, Long> {
    List<Vehicle> findAllByOrderByNameAsc();
    boolean existsByNameIgnoreCase(String name);
}
