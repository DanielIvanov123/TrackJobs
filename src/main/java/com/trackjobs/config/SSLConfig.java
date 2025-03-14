package com.trackjobs.config;

import org.apache.catalina.connector.Connector;
import org.apache.coyote.http11.Http11NioProtocol;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.File;

/**
 * Configuration for SSL/TLS settings
 * Configures HTTPS with appropriate security settings
 */
@Configuration
public class SSLConfig {

    @Value("${server.ssl.enabled:false}")
    private boolean sslEnabled;

    @Value("${server.ssl.key-store:}")
    private String keyStore;

    @Value("${server.ssl.key-store-password:}")
    private String keyStorePassword;
    
    @Value("${server.ssl.key-alias:}")
    private String keyAlias;

    @Value("${server.port:8080}")
    private int serverPort;

    @Value("${server.http.port:8080}")
    private int httpPort;

    /**
     * Customizes the Tomcat web server factory to configure SSL and redirect HTTP to HTTPS
     */
    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> servletContainerCustomizer() {
        return container -> {
            if (sslEnabled) {
                // Redirect HTTP to HTTPS
                container.addAdditionalTomcatConnectors(redirectConnector());
                
                // Configure SSL parameters
                container.addConnectorCustomizers(connector -> {
                    Http11NioProtocol protocol = (Http11NioProtocol) connector.getProtocolHandler();
                    
                    // Enable secure connection protocols
                    protocol.setSSLEnabled(true);
                    protocol.setSslEnabledProtocols("TLSv1.2,TLSv1.3");
                    
                    // Set secure cipher suites
                    protocol.setSSLHonorCipherOrder(true);
                    protocol.setCiphers("TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,"
                            + "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,"
                            + "TLS_DHE_RSA_WITH_AES_128_GCM_SHA256,"
                            + "TLS_DHE_RSA_WITH_AES_256_GCM_SHA384");
                    
                    // Key store settings
                    File keystoreFile = new File(keyStore);
                    if (keystoreFile.exists()) {
                        protocol.setKeystoreFile(keystoreFile.getAbsolutePath());
                        protocol.setKeystorePass(keyStorePassword);
                        protocol.setKeyAlias(keyAlias);
                    }
                });
            }
        };
    }

    /**
     * Creates an HTTP connector that redirects to HTTPS when SSL is enabled
     */
    private Connector redirectConnector() {
        Connector connector = new Connector(Http11NioProtocol.class.getName());
        connector.setScheme("http");
        connector.setPort(httpPort);
        connector.setSecure(false);
        connector.setRedirectPort(serverPort);
        return connector;
    }
}