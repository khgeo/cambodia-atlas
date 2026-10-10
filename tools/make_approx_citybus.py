"""
Build APPROXIMATE Phnom Penh City Bus data for the atlas (lines, stops).

Source: "Phnom Penh City Bus Route Map 2020" brochure (Phnom Penh Capital Hall / JICA):
  - stop names and order per line  -> transcribed from the English stop-list page
  - roads each line uses           -> from the schematic map legend
Geometry here is hand-traced through approximate waypoints on the named roads, and stops are
spaced evenly along each line. This is a PLACEHOLDER so the page works today.
Replace it with real coordinates using tools/build_citybus_osm.py (OpenStreetMap / ODC data).

Run:  python3 tools/make_approx_citybus.py
Out:  pages/transport-citybus/data/lines.geojson, stops.geojson
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "pages", "transport-citybus", "data")

# --- Anchor points (lon, lat), approximate -------------------------------------------
P = {
    "depot": (104.8870, 11.6780), "prekpnov": (104.8955, 11.6705), "km9": (104.9135, 11.6300),
    "nr5_s": (104.9165, 11.6050), "oldstadium": (104.9205, 11.5845), "bkc": (104.9190, 11.5800),
    "freedom": (104.9200, 11.5752), "station": (104.9160, 11.5755), "riverside": (104.9285, 11.5730),
    "angduong": (104.9240, 11.5708), "central": (104.9210, 11.5697), "monivong_cdg": (104.9180, 11.5690),
    "monivong_sih": (104.9176, 11.5590), "monivong_mao": (104.9178, 11.5455), "flyover": (104.9250, 11.5385),
    "monivong_br": (104.9310, 11.5375), "chbarampov": (104.9390, 11.5395), "boengchhuk": (104.9720, 11.5300),
    "kienvay": (105.0050, 11.5020), "princemanor": (105.0300, 11.4800),
    "norodom_n": (104.9252, 11.5740), "indep": (104.9285, 11.5565), "kbalthnal": (104.9290, 11.5415),
    "chakangre": (104.9330, 11.5100), "takhmao": (104.9460, 11.4790), "preksamrong": (104.9480, 11.4590),
    "olympic": (104.9110, 11.5585), "chenla": (104.9055, 11.5520), "sm_flyover": (104.9025, 11.5330),
    "sm_int": (104.8985, 11.5265), "tuolpongro": (104.8740, 11.5250), "bsp2": (104.8350, 11.5195),
    "vengsreng_w": (104.8560, 11.5300), "nr4_j": (104.8280, 11.5440), "tradecity": (104.7930, 11.5470),
    "chamkardoung": (104.8950, 11.5050), "prekkampues": (104.9100, 11.4620),
    "kk_w": (104.8960, 11.5640), "russian_7m": (104.8880, 11.5655), "century": (104.8760, 11.5620),
    "airport": (104.8450, 11.5530), "chaomchau": (104.8230, 11.5480),
    "aeonsensok": (104.8840, 11.6025), "camko": (104.9000, 11.5975), "itc": (104.8970, 11.5690),
    "tuoltumpung": (104.9180, 11.5452), "aeonmall": (104.9325, 11.5480),
    "st2004": (104.8720, 11.5580), "sleng": (104.8600, 11.4900), "vattanac": (104.8450, 11.4700),
}
W = lambda *keys_or_pts: [P[k] if isinstance(k, str) else k for k in keys_or_pts]

LINES = [
  dict(id="1A", color="#6abd45", from_en="Bus Depot", to_en="Boeng Chhuk", via="Preah Monivong", headway=(10,15),
       path=W("boengchhuk","chbarampov","monivong_br","flyover","monivong_mao","monivong_sih","monivong_cdg","bkc","oldstadium","nr5_s","km9","prekpnov","depot")),
  dict(id="1B", color="#4caf3d", from_en="Boeng Chhuk", to_en="Prince Manor Resort", via="NR-1", headway=(20,30),
       path=W("boengchhuk",(104.9880,11.5180),"kienvay","princemanor")),
  dict(id="2", color="#e32526", from_en="Kouch Kanong Roundabout", to_en="Prek Samrong Bridge", via="Preah Norodom", headway=(10,15),
       path=W("oldstadium",(104.9240,11.5800),"norodom_n","indep","kbalthnal","chakangre",(104.9400,11.4900),"takhmao","preksamrong")),
  dict(id="3", color="#1f4e9e", from_en="Freedom Park", to_en="Borey Sontepheap 2", via="Russian Federation Blvd", headway=(10,15),
       path=W("freedom","bkc",(104.9230,11.5790),"riverside","angduong","central",(104.9130,11.5662),"kk_w","russian_7m","century","airport","chaomchau",(104.8280,11.5260),"bsp2")),
  dict(id="4A", color="#f4a6c4", from_en="Freedom Park", to_en="Borey Sontepheap 2", via="Charles de Gaulle, Samdach Monireth", headway=(20,30),
       path=W("freedom","bkc","oldstadium",(104.9230,11.5790),"angduong","central",(104.9150,11.5640),"olympic","chenla","sm_flyover","sm_int",(104.8860,11.5265),"tuolpongro",(104.8550,11.5230),"bsp2")),
  dict(id="4B", color="#f28cb3", from_en="Freedom Park", to_en="Cambodia-China Trade City", via="Charles de Gaulle, Monireth, Veng Sreng", headway=(10,15),
       path=W("freedom","bkc","oldstadium",(104.9230,11.5790),"angduong","central",(104.9150,11.5640),"olympic","chenla","sm_flyover","sm_int","vengsreng_w","nr4_j",(104.8100,11.5455),"tradecity")),
  dict(id="4C", color="#f7bed5", from_en="Freedom Park", to_en="Prek Kampues Commune", via="Charles de Gaulle, Monireth", headway=(20,30),
       path=W("freedom","bkc","oldstadium",(104.9230,11.5790),"angduong","central",(104.9150,11.5640),"olympic","chenla","sm_flyover","sm_int","chamkardoung",(104.8935,11.4800),(104.8960,11.4680),"prekkampues")),
  dict(id="5A", color="#62c3e6", from_en="Bus Depot", to_en="Aeon Mall Sen Sok", via="Kob Srov Rd, Hanoi Friendship", headway=(20,30),
       path=W("depot",(104.8760,11.6620),(104.8720,11.6350),(104.8780,11.6120),"aeonsensok")),
  dict(id="5B", color="#3eb2df", from_en="Aeon Mall Sen Sok", to_en="Aeon Mall (Sothearos)", via="Samdach Sothearos, Mao Tse Toung", headway=(15,20),
       path=W("aeonsensok","camko",(104.8960,11.5850),"itc",(104.8990,11.5560),(104.9020,11.5470),"tuoltumpung",(104.9290,11.5455),"aeonmall")),
  dict(id="6", color="#7a1416", from_en="Kouch Kanong Roundabout", to_en="Bus Depot", via="NR-6, Win Win Blvd", headway=(15,20),
       path=W("oldstadium",(104.9310,11.5860),(104.9340,11.6200),(104.9350,11.6600),(104.9330,11.7000),(104.9300,11.7350),(104.9000,11.7380),(104.8720,11.7300),(104.8780,11.7000),"depot")),
  dict(id="7", color="#b0b0b0", from_en="Kilometer 9", to_en="Boeung Chhouk", via="Chea Sophara, St. 271", headway=(20,30),
       path=W("km9",(104.9050,11.6150),"camko",(104.8985,11.5800),(104.8975,11.5680),(104.8990,11.5480),"sm_flyover",(104.9150,11.5350),"flyover","monivong_br","chbarampov","boengchhuk")),
  dict(id="8", color="#d6d81f", from_en="Kouch Kanong Roundabout", to_en="St. 2004 Terminal", via="Oknha Khleang Moeung, Oknha Mong Rithy", headway=(20,30),
       path=W("oldstadium",(104.9050,11.5885),(104.8950,11.5900),(104.8700,11.5920),(104.8650,11.5800),(104.8660,11.5650),"st2004")),
  dict(id="9", color="#9b4a9b", from_en="Borey Sontepheap 2", to_en="Cambodia-China Trade City", via="NR-3, PPSEZ St., NR-4", headway=(15,20),
       path=W("bsp2",(104.8400,11.5000),"vattanac",(104.8150,11.4760),(104.7950,11.4900),(104.7900,11.5200),"tradecity")),
  dict(id="10", color="#9a8dc8", from_en="St. 2004 Terminal", to_en="Chbar Ampov Market", via="St. 2004, Sola St., St. 371", headway=(20,30),
       path=W("st2004",(104.8800,11.5560),(104.8860,11.5400),"sm_int",(104.9050,11.5250),(104.9150,11.5300),"flyover","monivong_br","chbarampov")),
  dict(id="11", color="#f0821e", from_en="Sleng Pagoda", to_en="Steung Meanchey Intersection", via="Prey Sar Rd, Chamkar Doung", headway=(20,30),
       path=W("sleng",(104.8750,11.4930),(104.8930,11.4960),"chamkardoung","sm_int")),
  dict(id="12", color="#1a9e8f", from_en="Cambodia Railway (circle)", to_en="Cambodia Railway (circle)", via="Nehru Blvd, St. 360, Preah Trasak Paem", headway=(20,30), loop=True,
       path=W("station",(104.9125,11.5720),(104.9120,11.5490),(104.9225,11.5470),(104.9235,11.5600),(104.9225,11.5725),"station")),
  dict(id="13", color="#3a7fc4", from_en="Cambodia Railway", to_en="Deum Thkov Market Roundabout", via="Czech Republic Blvd, St. 163", headway=(20,30),
       path=W("station",(104.9150,11.5650),(104.9140,11.5500),(104.9145,11.5460),(104.9150,11.5375))),
]

STOPS = {
"1A": """Boeng Chhuk Terminal|Monivong Flyover|Meteorology Station|Boeung Trabek Highschool|Ministry of Social Affairs|Ministry of Land Management|Monivong/Road 294|Preah Yukunthor High School|Wat Koh|BKC Intersection|Medical University|Information Ministry|Calmet Hospital|Old Stadium Roundabout|Doun Penh Health Center|Modern 5|Clinic Rak|Sokimex Park|Russey Keo High School|CTN Television|Samdach Ouv Health Center|Borey New World|Beltei International School|Chea Sim Chamreounroth Sec. School|Cash You Up Chrang Chamres|Prek Pnov Commune Office|Sand Depot Prek Pnov|Prek Pnov Bridge (West Side)|Prek Pnov Bridge (West Side) 2|City Bus Depot""",
"1B": """Boeng Chhuk Terminal|Caltex Fuel Station|Hun Sen Chba Ampov High School|Borey Peng Huot|Cho Ray Hospital|Boeng Chhuk Bus Terminal|Hang Pich Bakery|Preh Puthsathan Pagoda|Veal Sbov Pagoda|Prek Eng Commune Office|Chroy Ampil Pagoda|Machhim Vorn Pagoda|Champa Pagoda|Yok Bat Primary School|Kien Svay Plaza|Kien Svaykroa Pagoda|Kien Svay District Office|Kien Svay Hospital|Prince Manor Resort""",
"2": """Old Stadium Roundabout|Preah Put Khousacha Pagoda|National Maternal and Child Health|Kantha Bopha IV Hospital|Preah Ang Duong Hospital|Preah Norodom Primary School|Anti-Corruption Unit|Preah Sisowath High School|Chatumok Secondary School|National Institute of Education|Preah Norodom Blvd/St. 294|Mong Reththy Group|Thann Pagoda|Ministry of Agriculture and Fishery|Ministry of Interior|Ministry of Culture and Fine Arts|Kbal Thnal Market|CPAC Concrete Plant|Electricity Station 2|IIC University|Tuolrokar Village|Chakangre Krom|Chakangre Krom Health Center|Preah Noreay Roundabout|Takhmao Market|Takhmao Roundabout|ABA Takhmao Branch|Takhmao High School|Prek Samrong Bridge""",
"3": """Russey Keo Garden (Freedom Park)|Clinic Rak|Modern 5|Ponhea Kraek Primary School|Doun Penh Health Center|Kolab School|Happiness Guest House|Camintel Company|Bopha Titanic Restaurant|Night Market|Borribo Microfinance Plc|Ang Duong Hospital|Central Market|St. 128/St. 93|St. 128/St. 169|Sydney Super Market|St. 128/St. 215|Le President Hotel|Santhor Muk High School|St. 128/St. 261|7 Makara Flyover|Ministry of Commerce|Pochentong High School|Century Plaza Market|Chom Chav Roundabout|Koma Vision Center|Chumlung Malu Pagoda|Trapang Sila Pagoda Entrance|Hor Cheng Paper Plant|Borey Sontepheap II""",
"4A": """Russey Keo Garden (Freedom Park)|Clinic Rak|Modern 5|Ponheakaek Primary School|Old Stadium Roundabout|Ministry of Women's Affairs|National Maternal and Child Health|Kantha Bopha IV Children's Hospital|Ang Duong Hospital|Central Market|Soriya Cinema|Orussey Market|Preah Puth Mean Bon Pagoda|City Mall|International Olympic School|Chenla Theatre|Steung Meanchey Sky Bridge|Steung Meanchey Primary School|Cambodian University for Specialties|Nonmony Pagoda|Borey Peng Huot Steung Meanchey|Ek Reach III Market|Canadia Water Supply|Quality Factory Textile Co., Ltd|Tuol Pongro Market|Borey SJSI|Kom Peng Pagoda|Preah Thorm Trai Pagoda|General Factory|Borey Sontepheap II""",
"4B": """Russey Keo Garden (Freedom Park)|Clinic Rak|Modern 5|Ponheakaek Primary School|Old Stadium Roundabout|Ministry of Women's Affairs|National Maternal and Child Health|Kantha Bopha IV Children's Hospital|Ang Duong Hospital|Central Market|Soriya Cinema|Orussey Market|Preah Puth Mean Bon Pagoda|City Mall|International Olympic School|Chenla Theatre|Steung Meanchey Sky Bridge|Steung Meanchey Primary School|Cambodian University for Specialties|Nonmony Pagoda|The Church of Jesus Christ|Chom Chav Market|Extraordinary Chambers in the Courts of Cambodia|Borey New Hope|Glory Garment Factory|Ang Snuol Hospital|Golden Sound KTV|Hun Sen Ang Snuol High School|Chheang Menghong Bakery|Cambodia-China Trade City""",
"4C": """Russey Keo Garden (Freedom Park)|Clinic Rak|Modern 5|Ponheakaek Primary School|Old Stadium Roundabout|Ministry of Women's Affairs|National Maternal and Child Health|Kantha Bopha IV Children's Hospital|Ang Duong Hospital|Central Market|Soriya Cinema|Orussey Market|Preah Puth Mean Bon Pagoda|City Mall|International Olympic School|Chenla Theatre|Steung Meanchey Sky Bridge|Steung Meanchey Primary School|Cambodian University for Specialties|Nonmony Pagoda|Steung Meanchey Intersection|Borey Peng Huot|Sambou Meas Pagoda|Dangkor Primary and Secondary School|Tuol Ampil High School|Choeung Ek Commune Office|Steung Prek Chrey|Kouk Ovloek Village|Meanchey Bakery|Prek Kampues Commune Office""",
"5A": """City Bus Depot|Prek Pnov Bridge (East Side)|Orchidée KTV|Bridgeton School|Sovannumyvong Pagoda|ACLEDA Institute|Grand Phnom Penh|Okas Knhom Center Entrance|Khmuonh Primary School|Yu Huo Factory|Aeon Mall Sen Sok City""",
"5B": """Aeon Mall Sen Sok City|Borey New World (Camko City)|St. 1928/St. 1003|Borey Sun World|Western International School|Zaman International School|National Institute of Public Health|Institute of Technology of Cambodia|Sonthor Mok Primary School|Mondial Center|Derm Kor Market|Sunsimexco Company|Vanda Institute|American International Institute|Tuol Tumpung Pagoda|Bokor Intersection|Eton House International School|Ministry of Agriculture, Forestry & Fisheries|Hotel Sofitel Phnom Penh Phokeethra|Aeon Mall""",
"6": """Old Stadium Roundabout|JVC Technical School|Articker Company|Kien Khlang Pagoda|Asia Pacific International School|Kado Restaurant|Pizza Company|Khsach Meas Guest House|Borey Rung Roeurng|Borey High Land|Prek Lieb Pagoda|Prek Lieb National College of Agriculture|Borey De Mekong Royale|Koh Dach Ferry Terminal|Juxing Garment Factory|General Directorate of Rubber|Bak Khaeng Pagoda|VDS Garment Factory|National Road 6A/Win Win Blvd|Ly Yongphat Water Supply|Phnom Penh Safari Zoo Gate|Phnom Penh Safari|PNN Television Station|Morodok Decho Stadium|Tela Gas Station|Win Win Blvd (Prek Pnov Bridge)|City Bus Depot""",
"7": """Kilometer 9 Bus Terminal|Kilometer 9 Islamic Church|General Dept. of Public Works & Transport|Happy Garage II|LHR Gas Station|The Terrace Restaurant|K-fix Company|TV3 Station|Tela Rithy Petrol Station|GOGO International School|Bodamic Company|Borey Peng Huot|RooY7 Sport Club|Hun Sen Library|Preah Kossamak Hospital|Anuvath Primary School|General Department of Agriculture|Chea Sim Samaki High School|Steung Meanchey Flyover|Phnom Penh Sport Club|Dubai KTV|British Cambodian International School|Boeng Trobek Pump Station|Metrology Station|Monivong Flyover|Chbar Ampov Market|Caltex Gas Station|Hun Sen Chbar Ampov High School|Cho Ray Hospital|Boeng Chhuk Terminal""",
"8": """Old Stadium Roundabout|Beijing International School|Tuol Kork Pump Station|Tuol Kork TVK Station|Camko City Roundabout|Japan International Institute by LACP|Borey Peng Huot|Borey Chip Mong Land|Brown Coffee|Secondary School of Fine Arts|Ly Heng Gas Station|Green Feed Company|Borey Thai Chhun Kry|Jinh Fu Restaurant|Phnom Penh Municipal Health Department|Nonong KTV|Borey New World|LHR Gas Station|Relax Club|Century Plaza Market|St. 110/St. 2004|St. 2004 Terminal""",
"9": """Borey Sontepheap II|Hor Cheng Paper Plant|Trapang Sila Pagoda Entrance|Borey Sontepheap II Entrance|Toul Kei Primary School|Sheico Factory|Pong Teuk High School|Sleng Pagoda|Vattanac Industrial Entrance 2|Vattanac Industrial Entrance 1|Prateah Lang Street|Tang Roneam Pagoda|Phea Village|Princess Park|Prateah Lang Primary School|S.E.Z Security Guard Post|Heiko Asia (Cambodia) Co., Ltd|Winsun (Cambodia) Co., Ltd|Nikko-KINZOKU Co., Ltd|Mega Labels & Stickers Co., Ltd|Eurostar Diamonds Co., Ltd|Rokko Phoenix Co., Ltd|Medipro (Cambodia) Co., Ltd|Special Economic Zone Office|Denso (Cambodia) Co., Ltd|ACLEDA Bank|Glory Garment Factory|Ang Snuol Hospital|Hun Sen Ang Snuol High School|Cambodia-China Trade City""",
"10": """St. 2004 Terminal|St. 110/St. 2004|Happy Restaurant|Small Transport Army 99|U.T KTV|CCC Cambodia Sport Club|Orkide Villa|CIA First International School|Garment Factory 2004|CIA First English Center|Borey Peng Huot|Center for Coloring|Bell International School|FICAS International School|LHR Fuel Station (Sola St.)|Department of Animal Production|Cambodia Australia School|The Church of Jesus Christ|Phum Russey Primary School|Pothiihnein Pagoda|Mongkul Odom Center|Boeng Trobek Pump Station|Metrology Station|Monivong Bridge|Caltex Fuel Station|Chbar Ampov Market""",
"11": """Sleng Pagoda|Pong Teuk Commune Office|Pong Teuk Village|Mak Srey Khea Shop|Prey Veng Pagoda|Prey Veng Commune Office|Ratanak Deches Pagoda|Ang Metrey Pagoda|Preysor Center Intersection|Preysor East Village|Cheng Kung Furniture|Russahn Pagoda|Chamkar Doung Market|Tuol Ampil High School|Dangkor Commune Office|Dangkor Primary and Secondary School|Borey New World Chamkar Doung|Sambo Meas Pagoda|Borey Laykung|Construction World Co., Ltd|Steung Meanchey II Commune Office|Borey Peng Huot|Steung Meanchey Intersection""",
"12": """Cambodia Railway Station|Ministry of Rural Development|Ou Dem KTV|Heng Mihuo|Depot Market|Commercial Bank I|Olympic Reservoir Intersection|Lucky Fresh Flower Shop|Canadia Bank|Moha Muntrei Pagoda|Human Resource University|St. 163/St. 310|St. 360 Intersection|Paradi Tailor II|Tuol Sleng Genocide Museum|St. 360/Monivong|Modern Optic|Boeng Keng Kang High School|Thai Huot Mart|South-East Asia Co., Ltd|Anuvoth Primary School|PTT Fuel Station|Hong Leong Bank|Bubble Coffee|Doun Penh Secondary School|Pub Street|Ministry of Mines and Energy|Ta Pang Market|Back of Ang Duong Hospital|Cambodia Railway Station""",
"13": """Cambodia Railway Station|Kdann Pi Garden|Bak Touk High School|SIS International School|Sampov Meas Primary School|Sky Villa|Moha Muntrei Pagoda|Human Resource University|St. 163/St. 310|St. 360 Intersection|Fresh Pizza|St. 163/St. 245|Tuol Tumpung School|Sovannapoum School|Australian Center for Training|Doeum Thkov High School|Doeum Thkov Market Roundabout""",
}

def hav(a, b):
    R = 6371.0088
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dla, dlo = la2 - la1, math.radians(b[0] - a[0])
    h = math.sin(dla/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlo/2)**2
    return 2*R*math.asin(math.sqrt(h))

def cumdist(path):
    d = [0.0]
    for i in range(1, len(path)):
        d.append(d[-1] + hav(path[i-1], path[i]))
    return d

def point_at(path, cd, s):
    for i in range(1, len(path)):
        if cd[i] >= s:
            t = 0 if cd[i] == cd[i-1] else (s - cd[i-1]) / (cd[i] - cd[i-1])
            a, b = path[i-1], path[i]
            return (a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t)
    return path[-1]

def main():
    os.makedirs(OUT, exist_ok=True)
    lf, sf = [], []
    for L in LINES:
        path = L["path"]; cd = cumdist(path); total = cd[-1]
        names = [n.strip() for n in STOPS[L["id"]].split("|")]
        n = len(names)
        lf.append({"type": "Feature", "properties": {
            "line": L["id"], "color": L["color"], "from_en": L["from_en"], "to_en": L["to_en"],
            "via": L["via"], "headway_min": list(L["headway"]), "loop": bool(L.get("loop")),
            "length_km": round(total, 2), "n_stops": n, "geometry_quality": "approximate"},
            "geometry": {"type": "LineString", "coordinates": [[round(x, 6), round(y, 6)] for x, y in path]}})
        for i, nm in enumerate(names):
            s = total * i / (n - 1)
            x, y = point_at(path, cd, s)
            sf.append({"type": "Feature", "properties": {
                "id": f"{L['id']}-{i+1:02d}", "line": L["id"], "seq": i + 1, "name_en": nm, "name_km": "",
                "dist_km": round(s, 3), "position_quality": "approximate"},
                "geometry": {"type": "Point", "coordinates": [round(x, 6), round(y, 6)]}})
        print(f"Line {L['id']:>3}: {n:2d} stops, {total:5.1f} km")
    for name, feats in (("lines", lf), ("stops", sf)):
        with open(os.path.join(OUT, f"{name}.geojson"), "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(sf)} stops written to {OUT}")

if __name__ == "__main__":
    main()
