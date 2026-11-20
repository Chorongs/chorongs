package chorong.history.service.compareHistory;

import chorong.history.repository.CompareHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CompareHistoryServiceImpl implements CompareHistoryService {
    private final CompareHistoryRepository compareHistoryRepository;

    @Override
    @Transactional(readOnly = true)
    public void getCompareHistories() {
    }

    @Override
    @Transactional
    public void saveCompareHistory() {
    }

    @Override
    @Transactional
    public void deleteCompareHistory() {
    }

    @Override
    @Transactional
    public void deleteCompareHistories() {
    }
}
