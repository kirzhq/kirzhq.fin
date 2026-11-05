package com.kirzhq.finances.web;

import com.kirzhq.finances.service.CategoryService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApiExceptionHandlerTest {

    private final CategoryService service = mock(CategoryService.class);
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new CategoryController(service))
            .setControllerAdvice(new ApiExceptionHandler())
            .build();

    @Test
    void serviceErrorBecomesBadRequestWithMessage() throws Exception {
        when(service.create(any())).thenThrow(new IllegalArgumentException("Категория «Еда» уже есть"));

        mvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Еда\",\"type\":\"EXPENSE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Категория «Еда» уже есть"));
    }

    @Test
    void validationErrorNamesTheField() throws Exception {
        mvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"type\":\"EXPENSE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Название: обязательное поле"));
    }

    @Test
    void brokenJsonIsBadRequest() throws Exception {
        mvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void transactionRequestReadsExcludeFlagFromJson() throws Exception {
        var transactions = mock(com.kirzhq.finances.service.TransactionService.class);
        var captor = org.mockito.ArgumentCaptor.forClass(com.kirzhq.finances.web.dto.TransactionRequest.class);
        MockMvcBuilders.standaloneSetup(new TransactionController(transactions)).build()
                .perform(post("/api/transactions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"EXPENSE\",\"category\":\"Еда\",\"amount\":40,\"transactionDate\":\"2026-11-05\",\"excludedFromTotals\":true}"))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(transactions).create(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().excludedFromTotals()).isTrue();
    }
}
