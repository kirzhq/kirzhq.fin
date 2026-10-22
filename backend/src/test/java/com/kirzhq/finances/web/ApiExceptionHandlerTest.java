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
}
