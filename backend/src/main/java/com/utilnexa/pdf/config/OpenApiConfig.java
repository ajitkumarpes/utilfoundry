package com.utilnexa.pdf.config;

import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

  @Bean
  OpenAPI pdfPlatformOpenApi() {
    return new OpenAPI()
        .info(
            new Info()
                .title("UtilFoundry PDF API")
                .description("PDF processing, conversion, OCR, organization, and protection APIs.")
                .version("v1")
                .contact(new Contact().name("UtilFoundry"))
                .license(new License().name("Proprietary")))
        .externalDocs(
            new ExternalDocumentation()
                .description("UtilFoundry PDF web application")
                .url("http://localhost:3000"));
  }
}
