package chorong.history.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.history.dto.SearchHistoryRequestDTO;
import chorong.history.dto.SearchHistoryResponseDTO;
import chorong.history.entity.SearchHistory;
import chorong.history.repository.SearchHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SearchHistoryServiceImpl implements SearchHistoryService {
    private final SearchHistoryRepository searchHistoryRepository;

    @Override
    @Transactional(readOnly = true)
    public List<SearchHistoryResponseDTO> getSearchHistories(Long memberId) {
        List<SearchHistory> searchHistoryList =  searchHistoryRepository.findByMemberIdOrderBySearchIdDesc(memberId);
        List<SearchHistoryResponseDTO> searchHistoryResponseDTOList =
        searchHistoryList.stream().map(searchHistory -> new  SearchHistoryResponseDTO(searchHistory.getSearchId(), searchHistory.getSearchType(),
                searchHistory.getSearchLabel(), searchHistory.getSearchCondition(), searchHistory.getSearchedAt())
        ).toList();

        return searchHistoryResponseDTOList;

    }

    @Override
    @Transactional
    public void saveSearchHistory(Long memberId, SearchHistoryRequestDTO searchDTO) {
        Optional<SearchHistory> searchHistory =
                searchHistoryRepository.findByMemberIdAndSearchLabel(memberId, searchDTO.getLabel());
        if (searchHistory.isPresent()) {
            searchHistory.get().updateSearchedAt(LocalDateTime.now().withNano(0));
        }else {
            long searchHistoryCount =  searchHistoryRepository.countByMemberId(memberId);
            if (searchHistoryCount >= 10) {
                Optional<SearchHistory> firstSavedSearch =
                        searchHistoryRepository.findFirstByMemberIdOrderBySearchIdAsc(memberId);
                searchHistoryRepository.delete(firstSavedSearch.get());
            }
          SearchHistory saveSearchHistory = SearchHistory.builder()
                    .memberId(memberId)
                    .searchType(searchDTO.getType())
                    .searchLabel(searchDTO.getLabel())
                    .searchCondition(searchDTO.getCondition())
                    .searchedAt(LocalDateTime.now().withNano(0))
                    .build();
            try{
                searchHistoryRepository.save(saveSearchHistory);
            }catch (DataIntegrityViolationException e){
                throw new BusinessException(ErrorCode.CONFLICT);
            }
        }

    }

    @Override
    @Transactional
    public void deleteSearchHistory(Long memberId, Long searchId) {
        Optional<SearchHistory>  searchHistory = searchHistoryRepository.findByMemberIdAndSearchId(memberId, searchId);
        if (searchHistory.isPresent()) {
            searchHistoryRepository.delete(searchHistory.get());
        }else {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
    }

    @Override
    @Transactional
    public void deleteSearchHistories(Long memberId) {
        List<SearchHistory> searchHistoryList = searchHistoryRepository.findByMemberIdOrderBySearchIdDesc(memberId);
        searchHistoryRepository.deleteAll(searchHistoryList);
    }
}
