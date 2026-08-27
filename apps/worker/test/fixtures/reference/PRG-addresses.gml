<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:prg="urn:wastepl:test:prg">
  <!--
    Official-shaped deterministic regression fixture. TERC/SIMC/ULIC values mirror the
    reference slice. localId values and coordinates are TEST DATA and are not presented
    as production PRG identifiers/positions.
  -->
  <wfs:member>
    <prg:AD_PunktAdresowy gml:id="fixture-pa-1-maja-3">
      <prg:idIIP><prg:lokalnyId>fixture-pa-1-maja-3</prg:lokalnyId></prg:idIIP>
      <prg:terc>3261011</prg:terc><prg:simc>0949448</prg:simc><prg:ulic>11926</prg:ulic>
      <prg:numerPorzadkowy>3</prg:numerPorzadkowy><prg:kodPocztowy>75-800</prg:kodPocztowy>
      <prg:status>istniejacy</prg:status><prg:waznyOd>2026-01-01</prg:waznyOd><prg:aktualnyOd>2026-08-01T10:00:00Z</prg:aktualnyOd>
      <prg:pozycja><gml:Point srsName="urn:ogc:def:crs:EPSG::2180"><gml:pos>316071.6659575 706531.2938212</gml:pos></gml:Point></prg:pozycja>
    </prg:AD_PunktAdresowy>
  </wfs:member>
  <wfs:member>
    <prg:AD_PunktAdresowy gml:id="fixture-pa-1-maja-8">
      <prg:idIIP><prg:lokalnyId>fixture-pa-1-maja-8</prg:lokalnyId></prg:idIIP>
      <prg:terc>3261011</prg:terc><prg:simc>0949448</prg:simc><prg:ulic>11926</prg:ulic>
      <prg:numerPorzadkowy>8</prg:numerPorzadkowy><prg:kodPocztowy>75-800</prg:kodPocztowy>
      <prg:status>istniejacy</prg:status><prg:waznyOd>2026-01-01</prg:waznyOd><prg:aktualnyOd>2026-08-01T10:05:00Z</prg:aktualnyOd>
      <prg:pozycja><gml:Point srsName="urn:ogc:def:crs:EPSG::2180"><gml:pos>316100.0000000 706550.0000000</gml:pos></gml:Point></prg:pozycja>
    </prg:AD_PunktAdresowy>
  </wfs:member>
  <wfs:member>
    <prg:AD_PunktAdresowy gml:id="fixture-pa-bonin-2">
      <prg:idIIP><prg:lokalnyId>fixture-pa-bonin-2</prg:lokalnyId></prg:idIIP>
      <prg:terc>3209042</prg:terc><prg:simc>0308040</prg:simc>
      <prg:numerPorzadkowy>2</prg:numerPorzadkowy><prg:kodPocztowy>76-009</prg:kodPocztowy>
      <prg:status>istniejacy</prg:status><prg:waznyOd>2026-01-01</prg:waznyOd><prg:aktualnyOd>2026-08-01T11:00:00Z</prg:aktualnyOd>
      <prg:pozycja><gml:Point srsName="urn:ogc:def:crs:EPSG::4326"><gml:pos>16.248 54.152</gml:pos></gml:Point></prg:pozycja>
    </prg:AD_PunktAdresowy>
  </wfs:member>
  <wfs:member>
    <prg:AD_PunktAdresowy gml:id="fixture-pa-invalid-relation">
      <prg:idIIP><prg:lokalnyId>fixture-pa-invalid-relation</prg:lokalnyId></prg:idIIP>
      <prg:terc>3261011</prg:terc><prg:simc>9999999</prg:simc>
      <prg:numerPorzadkowy>99</prg:numerPorzadkowy><prg:kodPocztowy>75-800</prg:kodPocztowy>
      <prg:status>istniejacy</prg:status><prg:aktualnyOd>2026-08-01T12:00:00Z</prg:aktualnyOd>
      <prg:pozycja><gml:Point srsName="urn:ogc:def:crs:EPSG::4326"><gml:pos>16.2 54.2</gml:pos></gml:Point></prg:pozycja>
    </prg:AD_PunktAdresowy>
  </wfs:member>
</wfs:FeatureCollection>
