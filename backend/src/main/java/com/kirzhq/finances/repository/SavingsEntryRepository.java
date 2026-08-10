package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.SavingsEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SavingsEntryRepository extends JpaRepository<SavingsEntry, Long> {
    List<SavingsEntry> findAllByGoalId(Long goalId);
    List<SavingsEntry> findAllByGoalIdIn(List<Long> goalIds);
}
