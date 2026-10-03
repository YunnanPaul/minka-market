package com.minkamarket.ecommerce.controller;

import java.math.BigDecimal;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/configuracion")
public class ConfiguracionController {

    private final String storeAddress;
    private final String storeSchedule;
    private final BigDecimal igvRate;
    private final BigDecimal deliveryFee;
    private final BigDecimal freeDeliveryFrom;

    public ConfiguracionController(
            @Value("${app.store.address}") String storeAddress,
            @Value("${app.store.schedule}") String storeSchedule,
            @Value("${app.igv-rate}") BigDecimal igvRate,
            @Value("${app.delivery-fee}") BigDecimal deliveryFee,
            @Value("${app.free-delivery-from}") BigDecimal freeDeliveryFrom) {
        this.storeAddress = storeAddress;
        this.storeSchedule = storeSchedule;
        this.igvRate = igvRate;
        this.deliveryFee = deliveryFee;
        this.freeDeliveryFrom = freeDeliveryFrom;
    }

    @GetMapping
    public Map<String, Object> obtener() {
        return Map.of(
                "storeAddress", storeAddress,
                "storeSchedule", storeSchedule,
                "igvRate", igvRate,
                "deliveryFee", deliveryFee,
                "freeDeliveryFrom", freeDeliveryFrom
        );
    }
}
