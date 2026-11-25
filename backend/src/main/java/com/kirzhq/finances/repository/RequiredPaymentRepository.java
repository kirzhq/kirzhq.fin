package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.RequiredPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RequiredPaymentRepository extends JpaRepository<RequiredPayment, Long> {
    List<RequiredPayment> findAllByOrderByDayOfMonthAscNameAsc();

    boolean existsByCategoryIgnoreCase(String category);

    @Modifying
    @Query("update RequiredPayment p set p.category = :to where lower(p.category) = lower(:from)")
    int moveCategory(@Param("from") String from, @Param("to") String to);
}
