//inject angular file upload directives and services.
var app = angular.module('gliders', ['ngFileUpload','ngStorage','ngRoute','leaflet-directive']);

app.config(['$routeProvider', function($routeProvider){
    $routeProvider
        .when ('/', {
            templateUrl: 'views/frontPage.html',
            controller: 'uploadControler'
        })
        .when ('/views/campañas',{
            templateUrl: 'views/campañas.html',
            controller: 'campañasController'
        })
        .when ('/views/campañas/statistics',{
            templateUrl: 'views/statistics.html',
            controller: 'campañasStatisticsController'
        })
        .when ('/views/campañas/timeline',{
            templateUrl: 'views/timeline.html',
            controller: 'campañasTimelineController'
        })
        .when ('/views/campañas/tracks', {
            templateUrl: 'views/tracks.html',
            controller: 'tracksViewController'
        }) 
        .when ('/views/campañas/tracks/filter',{
            templateUrl: 'views/filter.html',
            controller: 'filterViewController'
        })
        .when ('/views/campañas/tracks/repair',{
            templateUrl: 'views/repair.html',
            controller: 'repairViewController'
        })
        .when ('/views/campañas/tracks/stats',{
            templateUrl: 'views/stats.html',
            controller: 'statsViewController'
        })           
}]);

app.factory('Glider', function($localStorage){

    var Glider = function(id, latlong, date, time){
        this.id=id, //Strait: LCA00031
        this.date=date,
        this.year=date[0].split('-')[0]
        this.month=date[0].split('-')[1]
        this.day=date[0].split('-')[2]
        this.latlong=latlong,
        this.time=time,
        this.point= this.pointGenerator(latlong,id),
        this.lines= this.pathGenerator(latlong,id),
        this.speed= this.calcVeloc(latlong, time),
        this.wind = this.syncronicFeatures(date,time,$localStorage.wind),//NULL FOR THOSE WITHOUT RECORDS
        this.current = this.syncronicFeatures(date,time,$localStorage.current),//NULL FOR THOSE WITHOUT RECORDS
        this.hourlydate = this.syncronicFeatures(date,time,$localStorage.hourlydate),//NULL FOR THOSE WITHOUT RECORDS
        this.windInterp = this.interpolation(this.wind,latlong),
        this.currentInterp = this.interpolation(this.current,latlong),
        this.windMean = this.average(this.wind, this.windInterp),
        this.currentMean = this.average(this.current, this.currentInterp),
        this.windMeanModule = this.windMean[0],
        this.windMeanDir = this.windMean[1],
        this.currentMeanModule = this.currentMean[0],
        this.currentMeanDir = this.currentMean[1]
    }

    Glider.prototype.distance = function (lat1, lon1, lat2, lon2, unit) {
      var radlat1 = Math.PI * lat1/180
      var radlat2 = Math.PI * lat2/180
      var theta = lon1-lon2
      var radtheta = Math.PI * theta/180
      var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
      dist = Math.acos(dist)
      dist = dist * 180/Math.PI
      dist = dist * 60 * 1.1515
      if (unit=="K") { dist = dist * 1.609344 }
      if (unit=="N") { dist = dist * 0.8684 }
      return dist
    }

    Glider.prototype.calcVeloc = function (latlong, time){
      var speed=[]; 
      for(var i=0; i<(latlong.length-1); i++){
        var dist = this.distance(latlong[i][0], latlong[i][1],latlong[i+1][0],latlong[i+1][1],"K")*1000 //en metros
        var t1= Number(time[i+1][0].split(":")[1]);
        var t0=Number(time[i][0].split(":")[1]);
        var time_diff = t1-t0; 
        if (time_diff<0 || time_diff===0){time_diff = 5}
        speed.push(dist/(60*(time_diff)));
      }
      return speed;
    }

    //METEORO SINCRONICO A LA DERIVA: insert as arrayParam wind, current or hourlydate.
    Glider.prototype.syncronicFeatures = function(date, time, arrayParam){
      var hours=[]; var hour;
      for (var j=0; j<time.length; j++){
        hours.push(time[j][0].split(":")[0]);
      } //array hours
      hour = hours.filter(function(item, position) {
        return hours.indexOf(item) == position;
      }) //array unique hours
      var equivalent=[];
      for(var i=0; i<hour.length;i++){
       equivalent.push(date +'-'+ hour[i])
      } //array notation: AA-MM-DD-HH
      
      var CurrParam=[]; //array de Param sincronico
      for (var k=0; k<equivalent.length; k++){
        var hourlydate = $localStorage.hourlydate;
        var pos = hourlydate.indexOf(equivalent[k])
        CurrParam.push(arrayParam[pos]) 
      }
      return CurrParam //array de Param sincronico
    }

    Glider.prototype.getRandomColor = function(){
        var letters = '0123456789ABCDEF'.split('');
        var color = '#';
        for (var i = 0; i < 6; i++ ) {
            color += letters[Math.floor(Math.random() * 16)];
        }
    return color;
    }

    Glider.prototype.getRandomInt=function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    Glider.prototype.pointGenerator = function(latlong, id){
        var gliderPoint = new Object;
        gliderPoint[id] = {
            lat: latlong[latlong.length-1][0], 
            lng: latlong[latlong.length-1][1],
            message: id   //RECENTLY ADDED LINE
            }
        return gliderPoint
    }

    Glider.prototype.pathGenerator = function(latlong, id){
        var gliderPath = new Object;
        var latlngs = [];
        for(var i=0; i<latlong.length; i++){
            var path = new Object;
            path['lat'] = latlong[i][0]
            path['lng'] = latlong[i][1]
            latlngs.push(path);
            }
        gliderPath[id] = {
                        color: this.getRandomColor(),
                        weight: this.getRandomInt(1,5),
                        latlngs: latlngs
                        }
        return gliderPath
    }

    Glider.prototype.interpolate = function(data, fitCount){   
    var linearInterpolate = function (before, after, atPoint) {
        return before + (after - before) * atPoint;
    };
    var newData = new Array();
    var springFactor = new Number((data.length - 1) / (fitCount - 1));
    newData[0] = data[0]; // for new allocation
    for ( var i = 1; i < fitCount - 1; i++) {
        var tmp = i * springFactor;
        var before = new Number(Math.floor(tmp)).toFixed();
        var after = new Number(Math.ceil(tmp)).toFixed();
        var atPoint = tmp - before;
        newData[i] = linearInterpolate(data[before], data[after], atPoint);
        }
    newData[fitCount - 1] = data[data.length - 1]; // for new allocation
    return newData;
    };

    Glider.prototype.interpolation = function(wind, latlong){
           if(wind[1] != null && wind[0] != null){
                var windModule=[]; var windDir=[];
                for (var k=0; k<wind.length; k++){
                    windModule.push(Number(wind[k][0]));
                    windDir.push(Number(wind[k][1]))
                }
                if(windDir.includes(0)){
                    console.log('problem here') //contains Dir 0; error interpolating ojo
                    console.log(windDir)
                    var inflexion = windDir.indexOf(0);
                    if(windDir[inflexion+1]>300){
                        var recomp = windDir.slice(inflexion,windDir.length)
                        recomp[0] = 360;
                        console.log(this.interpolate(windDir,latlong.length))
                        var min = Math.min.apply(null,this.interpolate(windDir,latlong.length))
                        var inflexion2 = this.interpolate(windDir,latlong.length).indexOf(min);
                        var keepInt = this.interpolate(windDir,latlong.length).slice(0,inflexion2+1)
                        var template = this.interpolate(windDir,latlong.length).slice(inflexion2+1,this.interpolate(windDir,latlong.length).length)
                        var recompInt = this.interpolate(recomp, template.length)
                        var rightOne = keepInt.concat(recompInt);
                        //console.log('array: '+windDir)
                        //console.log('position 0 array: '+inflexion)
                        //console.log('min interpolacion:'+min+' position min interpolacion: '+inflexion2)
                        //console.log('to recomp: '+recomp)
                        //console.log ('right computed:'+ keepInt)
                        //console.log('template: ' + template)
                        //console.log('parte recontruida:'+ recompInt)
                        console.log('todo reconstruido:'+ rightOne)
                        var windDirInterp = rightOne
                    }else{//CHECK WITH MORE BUOYS
                        var recomp = windDir.slice(0,inflexion)
                        recomp[recomp.length-1] = 360;
                        console.log(this.interpolate(windDir,latlong.length))
                        var min = Math.min.apply(null,this.interpolate(windDir,latlong.length))
                        var inflexion2 = this.interpolate(windDir,latlong.length).indexOf(min);
                        var keepInt = this.interpolate(windDir,latlong.length).slice(inflexion2+1,this.interpolate(windDir,latlong.length).length)
                        var template = this.interpolate(windDir,latlong.length).slice(0,inflexion2+1)
                        var recompInt = this.interpolate(recomp,template.length)
                        var rightOne = keepInt.concat(recompInt);
                        //console.log('array: '+windDir)
                        //console.log('position 0 array: '+inflexion)
                        //console.log('min interpolacion:'+min+' position min interpolacion: '+inflexion2)
                        //console.log('to recomp: '+recomp)
                        //console.log ('right computed:'+ keepInt)
                        //console.log('template: ' + template)
                        //console.log('parte recontruida:'+ recompInt)
                        console.log('todo reconstruido:'+ rightOne)
                        var windDirInterp = rightOne
                    } 
                }else{
                //console.log(windDir)
                //console.log($scope.interpolate(windDir,$localStorage.gliders[i].latlong.length))
                var windDirInterp = this.interpolate(windDir,latlong.length)
                }
            //console.log(windModule)
            //console.log($scope.interpolate(windModule,$localStorage.gliders[i].latlong.length))
            var windInterp = this.interpolate(windModule,latlong.length)                
        return [windInterp, windDirInterp]    
        }else{
        return null    
        }

    }
    
    Glider.prototype.average = function(array1, array){
        if(array1[1] != null && array1[0] != null){
            var module = [];
            var dir = [];
            var arrayModule = array[0]
            var arrayDir = array[1]
            console.log(arrayModule)
            console.log(arrayDir)
            for (var i=0; i<arrayModule.length; i++){
                console.log(arrayModule[i])
                console.log(arrayDir[i])
                module.push(arrayModule[i])
                dir.push(arrayDir[i])
            }
            var module_sum = module.reduce(function(previousValue, currentValue, currentIndex, array) {
  			return previousValue + currentValue;
			});
            var module_avg = module_sum / module.length;
            var dir_sum = dir.reduce(function(previousValue, currentValue, currentIndex, array) {
  			return previousValue + currentValue;
			});
            var dir_avg = dir_sum / dir.length;
        return [module_avg, dir_avg]
        }else{
            return [null,null]
        }
    }

return Glider
});


app.controller('uploadControler', ['$scope', 'Upload', '$timeout', '$localStorage','Glider', function ($scope, Upload, $timeout,$localStorage, Glider) {
    $scope.unique = function(array){ //mine
            var uniqueArray = array.filter(function(item, position) {
            return array.indexOf(item) == position;
            })
            return uniqueArray
        }
    $scope.newPage = function (){//mine
    location.href = '#/views/campañas';
    };
    //Files Upload from //http://jsfiddle.net/danialfarid/s8kc7wg0/400/
    $scope.$watch('files', function () {
        $scope.upload($scope.files);
    });
    $scope.$watch('file', function () {
        if ($scope.file != null) {
            $scope.files = [$scope.file]; 
        }
    });
    $scope.meteoFilename = []; //mine
    $scope.gliderNames = []; //mine
    $scope.upload = function (files) {
        if (files && files.length) {
            for (var i = 0; i < files.length; i++) {
              var file = files[i];
              if (!file.$error) {
                Upload.upload({
                    url: 'https://angular-file-upload-cors-srv.appspot.com/upload',
                    data: {
                      username: $scope.username,
                      file: file  
                    }
                }).then(function (resp) {
                }, null, function (evt) { 
                    if(evt.config.data.file.name.split('.')[1]=="tsv"){
                        $scope.meteoFilename.push(evt.config.data.file.name); //mine
                        $localStorage.meteoFilename = $scope.unique($scope.meteoFilename);//mine
                        //console.log($scope.unique($scope.meteoFilename))  
                    }else{
                        $scope.gliderNames.push(evt.config.data.file.name);
                        $localStorage.gliderNames = $scope.unique($scope.gliderNames)
                        //console.log($scope.unique($scope.gliderNames))
                    }             
                });
              }
            }
        }
    };
    //OceanFeatures lecture
    $scope.oceanFeatures = function (){
        var wind = [];
        var current=[];
        var hourlydate=[];
        console.log($localStorage.meteoFilename[0])
        d3.tsv("/meteo/"+$localStorage.meteoFilename[0], function(data) {
        var result1; var result;
            for (var i=0; i<data.length; i++){
                result_1 = (data[i]["AA MM DD HH    Hm0   Tm02    Tp   Hmax  Thmax  Pro_Oe   Dmd   Dmd_P  Ds_P  Pro_Od   Ts2    Sa2   Vc_md  Dc_md Pro_Oce   Ps     Ta  Vv_md  Dv_md   Pro_Met Qc_e"]);
                result = result_1.split(" ").filter(function( obj ) {return obj != ""});
                hourlydate.push(result[0]+'-'+result[1]+'-'+result[2]+'-'+result[3]);
                current.push([result[16]/100, result[17]]);//en m/s!!!!! (venia en cm/s)
                wind.push([result[21],result[22]]); //en m/s!!!!!
            }
        $localStorage.wind = wind;
        $localStorage.current = current;
        $localStorage.hourlydate=hourlydate;
        });   
    }

    //Gliders' files lecture && creation
    $scope.gliderCreation = function(){
        var TotalGliders = [];
        //$scope.gliderNames = $localStorage.gliderNames;
        var leafletdataLines = new Object();
        var leafletdataPoints = new Object();
        for(var i=0; i<$localStorage.gliderNames.length; i++){
            //Gliders' files lecture
            d3.csv('/prueba/'+$localStorage.gliderNames[i], function(data) {
                 var latlong = data.map(function(d) { return [+d["Latitude"],+d["Longitude"]]; });
                 var date = data.map(function(d) { return [d["Date"]]; });
                 var time = data.map(function(d) { return [d["Time"]]; });
                 var id = "LCA00031" +'_' + date[0];
                 //Gliders' creation
                 var glider= new Glider(id, latlong, date[0], time);
                 TotalGliders.push(glider);
                 $localStorage.gliders=TotalGliders; 
                 console.log(TotalGliders)
            });
        } 
    };
}]);

app.controller('campañasController', ['$scope', '$localStorage', function ($scope, $localStorage) {
    angular.extend($scope, {
                center: {
                    lat: 35.98609,
                    lng: -5.60336,
                    zoom: 10
                },
                gliderPaths: {},
                gliderPoints: {},
                events: {}
    });
    $scope.gliders = $localStorage.gliders
    
    $scope.glidersPaths1 = new Object;
        for (k=0; k<$scope.gliders.length; k++){
            $scope.glidersPaths1['l'+(k+1)] = $scope.gliders[k].lines[Object.keys($scope.gliders[k].lines)[0]]
            $localStorage.gliderPaths = $scope.glidersPaths1
        }
        $scope.gliderPaths =$localStorage.gliderPaths;
    
    $scope.glidersPoints1 = new Object;
        for (k=0; k<$scope.gliders.length; k++){
            $scope.glidersPoints1['p'+(k+1)] = $scope.gliders[k].point[Object.keys($scope.gliders[k].point)[0]]
            $localStorage.gliderPoints =  $scope.glidersPoints1
        }
    $scope.gliderPoints =$localStorage.gliderPoints;
}]);

//GRAFICAS GLOBALES
app.controller('campañasStatisticsController', ['$scope', 'leafletData', '$localStorage', function ($scope, leafletData, $localStorage) {
    $scope.gliders = $localStorage.gliders
    $scope.newPage = function (){//mine
        location.href = '#/views/campañas';
    };
    $scope.counter = function(key, value,array){
    return array.filter(function(obj){return obj[key]==value}).length;
    } 

    $scope.unique = function(array){ //mine
        var uniqueArray = array.filter(function(item, position) {
        return array.indexOf(item) == position;
        })
        return uniqueArray
    }

    $scope.drawPie = function (){
        var types = [];
            for (t=0; t<$scope.gliders.length; t++){
                types.push($scope.gliders[t].year);
            }
        console.log(types)
        console.log($scope.unique(types))
        var pieData = []
        for (i=0; i<$scope.unique(types).length; i++){
            pieData.push($scope.counter('year',$scope.unique(types)[i],$scope.gliders))
        }
        console.log(pieData)
        var data = [{
        values: pieData,
        labels: $scope.unique(types),
        type: 'pie'
        }];
        console.log(data)

        var layout = {height: 380, width: 480};
        
        Plotly.newPlot('myDiv', data, layout);
    }

    $scope.drawPie()
    
    $scope.drawMonthlyData = function (){

        var types = [];
            for (t=0; t<$scope.gliders.length; t++){
                types.push($scope.gliders[t].year);
            }

        var monthlyData =[]
            for (var i=0; i<$scope.unique(types).length; i++){
                var gliderYear = $scope.gliders.filter(function(obj){return obj['year']==$scope.unique(types)[i]})
                console.log(gliderYear)
                var trace = new Object;
                trace['x'] = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
                trace['y'] = [$scope.counter('month','01',gliderYear), $scope.counter('month','02',gliderYear),$scope.counter('month','03',gliderYear),$scope.counter('month','04',gliderYear), $scope.counter('month','05',gliderYear),$scope.counter('month','06',gliderYear), $scope.counter('month','07',gliderYear), $scope.counter('month','08',gliderYear), $scope.counter('month','09',gliderYear), $scope.counter('month','10',gliderYear), $scope.counter('month','11',gliderYear), $scope.counter('month','12',gliderYear)];
                trace['name'] = $scope.unique(types)[i]
                trace['type'] = 'bar'
                monthlyData.push(trace)
            }
        var layout = {barmode: 'group'};

        Plotly.newPlot('myDiv2', monthlyData, layout);
    }
    
    //dibujar graficas de viento (Beufort and current strenght)
    $scope.drawMonthlyData()
    $scope.wind = function(){
        }
    $scope.current = function(){
        }
    //hours of deriva   
var data = [
  {
    x: ['giraffes', 'orangutans', 'monkeys'],
    y: [20, 14, 23],
    type: 'bar'
  }
];

Plotly.newPlot('myDiv3', data);
var trace1 = {
  x: ['Product A', 'Product B', 'Product C'],
  y: [20, 14, 23],
  type: 'bar',
  text: ['27% market share', '24% market share', '19% market share'],
  marker: {
    color: 'rgb(158,202,225)',
    opacity: 0.6,
    line: {
      color: 'rbg(8,48,107)',
      width: 1.5
    }
  }
};

var data = [trace1];

var layout = {
  title: 'January 2013 Sales Report'
};

Plotly.newPlot('myDiv4', data, layout);

var trace1 = {
  x: [20, 14, 23],
  y: ['giraffes', 'orangutans', 'monkeys'],
  name: 'SF Zoo',
  orientation: 'h',
  marker: {
    color: 'rgba(55,128,191,0.6)',
    width: 1
  },
  type: 'bar'
};

var trace2 = {
  x: [12, 18, 29],
  y: ['giraffes', 'orangutans', 'monkeys'],
  name: 'LA Zoo',
  orientation: 'h',
  type: 'bar',
  marker: {
    color: 'rgba(255,153,51,0.6)',
    width: 1
  }
};

var data = [trace1, trace2];

var layout = {
  title: 'Colored Bar Chart',
  barmode: 'stack'
};

Plotly.newPlot('myDiv5', data, layout);

var data = [{
  type: 'bar',
  x: [20, 14, 23],
  y: ['giraffes', 'orangutans', 'monkeys'],
  orientation: 'h'
}];

Plotly.newPlot('myDiv6', data);
}]);

app.controller('campañasTimelineController', ['$scope', '$filter', 'leafletData', '$localStorage', function ($scope,$filter,leafletData, $localStorage) {
    angular.extend($scope, {
                center: {
                    lat: 35.98609,
                    lng: -5.60336,
                    zoom: 10
                },
                gliderPaths: {},
                gliderPoints: {},
                events: {}
    });
    $scope.gliders = $localStorage.gliders
    $scope.newPage = function (){//mine
        location.href = '#/views/campañas';
    };
    $scope.sortedByDate = function(arrayOfObjects, date){
        var orderedObj = arrayOfObjects.slice(0);// use slice() to copy the array and not just make a reference
        orderedObj.sort(function(a,b) {
        return new Date(a[date][0]) - new Date(b[date][0]);
        });
        return orderedObj
    }

    $scope.glidersOrdered=$scope.sortedByDate($scope.gliders, 'date')

    $scope.monthNameToNumb = function(monthName){
        var monthtbl = { 'enero':'01', 'febrero':'02', 'marzo':'03', 'abril': '04','mayo':'05' , 'junio':'06' , 'julio':'07', 'agosto':'08', 'septiembre':'09', 'octubre':'10', 'noviembre':'11', 'diciembre': '12' };
        var monthNumb = monthtbl[monthName];
        return monthNumb;
    }

    $scope.monthNumbToName = function(monthNumber){
        var monthtbl = { '01': 'enero', '02':'febrero', '03': 'marzo', '04':'abril' ,'05': 'mayo', '06': 'junio', '07': 'julio', '08': 'agosto', '09':'septiembre' , '10':'octubre' , '11':'noviembre', '12': 'diciembre' };
        var monthName = monthtbl[monthNumber];
        return monthName;
    }
    //watching changes when yearFilter
    $scope.$watch('yearFilter', function(newVal, oldVal) {
      // this is the JS equivalent of "phones | filter: newVal"
      $scope.filteredArray = $filter('filter')($scope.glidersOrdered, {year: newVal});
      if($scope.filteredArray.length <= $localStorage.gliders.length){
        var glidersPaths1 = new Object;
            for (k=0; k<$scope.filteredArray.length; k++){
                glidersPaths1['l'+(k+1)] = $scope.filteredArray[k].lines[Object.keys($scope.filteredArray[k].lines)[0]]
                $localStorage.gliderPaths = glidersPaths1
            }
            $scope.gliderPaths =$localStorage.gliderPaths;
        var glidersPoints1 = new Object;
            for (k=0; k<$scope.filteredArray.length; k++){
                glidersPoints1['p'+(k+1)] = $scope.filteredArray[k].point[Object.keys($scope.filteredArray[k].point)[0]]
                $localStorage.gliderPoints = glidersPoints1
            }
            $scope.gliderPoints =$localStorage.gliderPoints;
        }
    });
    //watching changes when monthFilter
    $scope.$watch('monthNameToNumb(monthFilter)', function(newVal, oldVal) {
      console.log("new value in filter box:", newVal);
      // this is the JS equivalent of "phones | filter: newVal"
      $scope.filteredArray = $filter('filter')($scope.glidersOrdered, {month: newVal});
      console.log($scope.filteredArray)
      if($scope.filteredArray.length <= $localStorage.gliders.length){
        var glidersPaths1 = new Object;
            for (k=0; k<$scope.filteredArray.length; k++){
                glidersPaths1['l'+(k+1)] = $scope.filteredArray[k].lines[Object.keys($scope.filteredArray[k].lines)[0]]
                $localStorage.gliderPaths = glidersPaths1
            }
            $scope.gliderPaths =$localStorage.gliderPaths;
        var glidersPoints1 = new Object;
            for (k=0; k<$scope.filteredArray.length; k++){
                glidersPoints1['p'+(k+1)] = $scope.filteredArray[k].point[Object.keys($scope.filteredArray[k].point)[0]]
                $localStorage.gliderPoints = glidersPoints1
            }
            $scope.gliderPoints =$localStorage.gliderPoints;
        }
    });
}]);

//BOOTSFLAT TIME LINE: MAPA DEL AÑO + GRAFICAS + CARACTERÍSTICAS
//http://bootflat.github.io/documentation.html
//CAMPAÑAS: MAP && GRAPHS: TIME-LINE & DATA EXPLORATION
//PATH DECORATION EXAMPLE: http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/paths/decorations-simple-example
//LEGEND EXAMPLE FOR NOISE: http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/basic/legend-example;
//SHOW-HIDE MAP: http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/basic/hide-show-map-example


//MAPA INICIAL CON PANEL DE COLORES (VELOCIDADES)
//QUIZAS HACER: REPARACION (REMOVE, BLOWNOISE, SMOOTH)
//FILTRADO (BY OCENOGRAPHIC FEATURES && BY DATE)
app.controller('tracksViewController', ['$scope', 'leafletData', '$localStorage', function ($scope,leafletData, $localStorage) {
    angular.extend($scope, {
                center: {
                    lat: 35.98609,
                    lng: -5.60336,
                    zoom: 10
                },
                gliderPaths: {},
                gliderPoints: {},
                events: {}
    });
    $scope.newPage = function (){//mine
        location.href = '#/views/campañas';
    };
    $scope.newPage1 = function (){//mine
        location.href = '#/views/campañas/tracks/filter';
    };
    $scope.newPage2 = function (){//mine
        location.href = '#/views/campañas/tracks/repair';
    };
    $scope.newPage3 = function (){//mine
        location.href = '#/views/campañas/tracks/stats';
    };

    $scope.gliders = $localStorage.gliders
    
    $scope.glidersPaths1 = new Object;
        for (k=0; k<$scope.gliders.length; k++){
            $scope.glidersPaths1['l'+(k+1)] = $scope.gliders[k].lines[Object.keys($scope.gliders[k].lines)[0]]
            $localStorage.gliderPaths = $scope.glidersPaths1
        }
        $scope.gliderPaths =$localStorage.gliderPaths;
    
    $scope.glidersPoints1 = new Object;
        for (k=0; k<$scope.gliders.length; k++){
            $scope.glidersPoints1['p'+(k+1)] = $scope.gliders[k].point[Object.keys($scope.gliders[k].point)[0]]
            $localStorage.gliderPoints =  $scope.glidersPoints1
        }
    $scope.gliderPoints =$localStorage.gliderPoints;

}]);

app.controller('filterViewController', ['$scope', '$filter','leafletData', '$localStorage', function ($scope, $filter, leafletData, $localStorage) {
    angular.extend($scope, {
                center: {
                    lat: 35.98609,
                    lng: -5.60336,
                    zoom: 10
                },
                gliderPaths: {},
                gliderPoints: {},
                events: {}
    });
    $scope.newPage = function (){//mine
        location.href = '#/views/campañas';
    };
    $scope.newPage2 = function (){//mine
        location.href = '#/views/campañas/tracks/repair';
    };
    $scope.newPage3 = function (){//mine
        location.href = '##/views/campañas/tracks/stats';
    };    
    $scope.monthNameToNumb = function(monthName){
        var monthtbl = { 'enero':'01', 'febrero':'02', 'marzo':'03', 'abril': '04','mayo':'05' , 'junio':'06' , 'julio':'07', 'agosto':'08', 'septiembre':'09', 'octubre':'10', 'noviembre':'11', 'diciembre': '12' };
        var monthNumb = monthtbl[monthName];
        return monthNumb;
    }
    
    $scope.gliders = $localStorage.gliders
    
    //watching changes when yearFilter&monthFilter
    $scope.$watchGroup(['yearFilter','monthNameToNumb(monthFilter)'], function(newValues, oldValues, scope) {
        $scope.filteredArray = $filter('filter')($scope.gliders, {year:newValues[0], month: newValues[1]});
        console.log($scope.filteredArray.length)
        if($scope.filteredArray.length <= $localStorage.gliders.length){
        var glidersPaths1 = new Object;
            for (k=0; k<$scope.filteredArray.length; k++){
                glidersPaths1['l'+(k+1)] = $scope.filteredArray[k].lines[Object.keys($scope.filteredArray[k].lines)[0]]
                $localStorage.gliderPaths = glidersPaths1
            }
            $scope.gliderPaths =$localStorage.gliderPaths;
        var glidersPoints1 = new Object;
            for (k=0; k<$scope.filteredArray.length; k++){
                glidersPoints1['p'+(k+1)] = $scope.filteredArray[k].point[Object.keys($scope.filteredArray[k].point)[0]]
                $localStorage.gliderPoints = glidersPoints1
            }
            $scope.gliderPoints =$localStorage.gliderPoints;
        }
    });
    //watching changes when windFilter & currentFilter
    $scope.gteComparator = function(a,b) {
    return a >= b;
    };
    //guardar las medias de viento y corrientes en campos independientes para facilitar luego el filtrado

    $scope.$watchGroup(['windFilter','windDirFilter','currentFilter','currentDirFilter'], function(newValues, oldValues, scope) {
        $scope.filteredArray = $filter('filter')($scope.gliders, {windMeanModule:newValues[0], windMeanDir:newValues[1], currentMeanModule:newValues[2], currentMeanDir:newValues[3]}, $scope.gteComparator);
        console.log($scope.filteredArray)
        if($scope.filteredArray.length <= $localStorage.gliders.length){
        var glidersPaths1 = new Object;
            for (k=0; k<$scope.filteredArray.length; k++){
                glidersPaths1['l'+(k+1)] = $scope.filteredArray[k].lines[Object.keys($scope.filteredArray[k].lines)[0]]
                $localStorage.gliderPaths = glidersPaths1
            }
            $scope.gliderPaths =$localStorage.gliderPaths;
        var glidersPoints1 = new Object;
            for (k=0; k<$scope.filteredArray.length; k++){
                glidersPoints1['p'+(k+1)] = $scope.filteredArray[k].point[Object.keys($scope.filteredArray[k].point)[0]]
                $localStorage.gliderPoints = glidersPoints1
            }
            $scope.gliderPoints =$localStorage.gliderPoints;
        }
    })

    //  WIND DIR
    //determine average wind direction description: no tan trivial 
    //como se ha hecho en el glider prototype con una media normal y corriente
/*if (directionaverage > 348) {avgdirection = "North";}
else if (directionaverage > 326) {avgdirection = "North North West";}
else if (directionaverage > 303) {avgdirection = "North West";}
else if (directionaverage > 281) {avgdirection = "West North West";}
else if (directionaverage > 258) {avgdirection = "West";}
else if (directionaverage > 236) {avgdirection = "West South West";}
else if (directionaverage > 213) {avgdirection = "South West";}
else if (directionaverage > 191) {avgdirection = "South South West";}
else if (directionaverage > 168) {avgdirection = "South";}
else if (directionaverage > 146) {avgdirection = "South South East";}
else if (directionaverage > 123) {avgdirection = "South East";}
else if (directionaverage > 101) {avgdirection = "East South East";}
else if (directionaverage > 78) {avgdirection = "East";}
else if (directionaverage > 56) {avgdirection = "East North East";}
else if (directionaverage > 33) {avgdirection = "North East";}
else if (directionaverage > 11) {avgdirection = "North North East";}
else if (directionaverage >= 0) {avgdirection = "North";}*/
}]);

app.controller('repairViewController', ['$scope', 'leafletData', '$localStorage', function ($scope,leafletData, $localStorage) {
    angular.extend($scope, {
                center: {
                    lat: 35.98609,
                    lng: -5.60336,
                    zoom: 10
                },
                gliderPaths: {},
                gliderPoints: {},
                events: {}
    });
    $scope.newPage = function (){//mine
        location.href = '#/views/campañas';
    };
    $scope.gliders = $localStorage.gliders
    $scope.newPage3 = function (){//mine
        location.href = '#/views/campañas/tracks/stats';
    };    
    $scope.monthNameToNumb = function(monthName){
        var monthtbl = { 'enero':'01', 'febrero':'02', 'marzo':'03', 'abril': '04','mayo':'05' , 'junio':'06' , 'julio':'07', 'agosto':'08', 'septiembre':'09', 'octubre':'10', 'noviembre':'11', 'diciembre': '12' };
        var monthNumb = monthtbl[monthName];
        return monthNumb;
    }

    $scope.monthNumbToName = function(monthNumber){
        var monthtbl = { '01': 'enero', '02':'febrero', '03': 'marzo', '04':'abril' ,'05': 'mayo', '06': 'junio', '07': 'julio', '08': 'agosto', '09':'septiembre' , '10':'octubre' , '11':'noviembre', '12': 'diciembre' };
        var monthName = monthtbl[monthNumber];
        return monthName;
    }

    $scope.glidersPaths1 = new Object;
        for (k=0; k<$scope.gliders.length; k++){
            $scope.glidersPaths1['l'+(k+1)] = $scope.gliders[k].lines[Object.keys($scope.gliders[k].lines)[0]]
            $localStorage.gliderPaths = $scope.glidersPaths1
        }
    $scope.gliderPaths =$localStorage.gliderPaths;
    
    $scope.glidersPoints1 = new Object;
        for (k=0; k<$scope.gliders.length; k++){
            $scope.glidersPoints1['p'+(k+1)] = $scope.gliders[k].point[Object.keys($scope.gliders[k].point)[0]]
            $localStorage.gliderPoints =  $scope.glidersPoints1
        }
    $scope.gliderPoints =$localStorage.gliderPoints;
    
    $scope.getRandomInt=function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    $scope.getRandomColor = function(){
        var letters = '0123456789ABCDEF'.split('');
        var color = '#';
        for (var i = 0; i < 6; i++ ) {
            color += letters[Math.floor(Math.random() * 16)];
        }
    return color;
    }
    $scope.peakFinder = function(array){
      // instantiate an array as result
      var result = [];
      // iterate over input
      array.forEach(function(val,key,col){
        // check left and right neighbors
            if(col[key+1] < val && col[key-1] < val) {
              // add information to results array
              result.push([key,val]);
            }
            // ternary check: if results array is not empty give result array, else give false
            return result.length ? result : false;
        });
    }

    $scope.arrayBuoys = [];
    $scope.arrayPoints = [];
    $scope.arrayLines = [];
    
    $scope.$on("leafletDirectiveMarker.mousedown", function(event, args){
        var leafEvent = args.leafletEvent.latlng;
        var Points = $localStorage.gliderPoints;
        var buoy = new Object;
        for (j=0; j<Object.keys(Points).length; j++){   
            if(leafEvent.lat == Points[Object.keys(Points)[j]].lat){
                var selectedBuoy = $localStorage.gliders[Object.keys(Points)[j].split('p')[1]-1]
                buoy['name']=selectedBuoy[Object.keys(selectedBuoy)[0]]
                //console.log('Ha clicado la boya:'+' '+ selectedBuoy[Object.keys(selectedBuoy)[0]])
            $scope.arrayBuoys.push(buoy)
            $scope.arrayPoints.push(Object.keys(Points)[j]);
            $scope.arrayLines.push(Object.keys($localStorage.gliderPaths)[j]);
            console.log($scope.arrayBuoys)
            console.log($scope.arrayPoints)
            console.log($scope.arrayLines)
            }
        }
    });

    //IMPLEMENTAR EL DELETE O PROPIEDAD OPACITY PARA QUE 'DESAPAREZCAN' EN EL APARTADO DE FILTRADO YAAAAAAAAAAAAAAA!!!
    $scope.delete = function (){
        for (j=0; j<$scope.arrayPoints.length; j++){ 
            delete $scope.gliderPoints[$scope.arrayPoints[j]]
            delete $scope.gliderPaths[$scope.arrayLines[j]]
            }
            //cambios temporales(sobre scope; no sobre localstorage)
        $scope.arrayBuoys= []
        $scope.arrayPoints =[]
        $scope.arrayLines = []
    }

    //REVISAR COMO DETECTAR SALTOS: AL FINAL ESTE BOTÓN SE DESACTIVÓ
    //originalmente identificaba en rojo el ruido de la zodiac de salvamento maritimo
    /*$scope.showNoise = function (){
        //finding noise via velocity check
        for (var i=0; i<$localStorage.gliders.length; i++){
            var latlong = $localStorage.gliders[i].latlong;
            var speed = $localStorage.gliders[i].speed;

            var a=[]; //posiciones v>2m/s
            speed.forEach(function(element) {if (element>2){ var pos = speed.indexOf(element); a.push(pos)}})
            var uniqueArray = a.filter(function(item, position) {
                return a.indexOf(item) == position;
            }) //filtrado posiciones

            //fixed-end (5 elementos últimos)
            if(uniqueArray[uniqueArray.length-1]<speed.length-1 && uniqueArray[uniqueArray.length-1]>speed.length-6){
              for(var g=uniqueArray[uniqueArray.length-1]; g<speed.length; g++){
                uniqueArray.push(g)
              }
            }

            //fixed-origin (5 elementos primeros)
            if(uniqueArray[0]>0 && uniqueArray[0]<5){
              for(var g=0; g<uniqueArray[0]; g++){
                uniqueArray.push(g)
              }
            }

            var uniqueArray3 = uniqueArray.filter(function(item, position) {
                return uniqueArray.indexOf(item) == position;
            })//////ERST ????

            var uniqueArray2 = uniqueArray3.sort(function(a, b){return a-b}); 
            console.log(uniqueArray2)
            if(uniqueArray2.length>4){//para las primeras 14 derivas eso parece
            var Noise=[]; 
            for(var k=0; k<speed.length; k++){
              if(uniqueArray2.length>0 && uniqueArray2.includes(k)===true){
                Noise.push(latlong[k])
              }
            }
            
            //¿EMPAREJAR? ir generando arrays de par de lat-longs
            $localStorage.gliders[i]["Noise"]=Noise; //Positions with Noise
            //var checkJumpsLat=[];
            //var checkJumpsLng=[]
            var newValues = []; //red path (noise)
            for(var h=0; h<Noise.length; h++){
                var newValuesObj = new Object;
                //checkJumpsLat.push(Noise[h][0]);
                //checkJumpsLng.push(Noise[h][1])
                newValuesObj['lat'] = Noise[h][0]
                newValuesObj['lng'] = Noise[h][1]
                newValues.push(newValuesObj);
            } //there is no 0 point or line

            $scope.gliderPaths['lred'+(i)] = {
                        color: 'red',
                        weight: $scope.getRandomInt(3,3),
                        latlngs: newValues}
            $localStorage.Paths= $scope.gliderPaths //cambio permanente
            
            //$localStorage.Points['pred'+(i+1)] = $scope.gliderPoints['pred'+(i+1)] //cambio permanente
            //lo que sigue se puede quitar cuando se vea si el filtrado es correcto
            }
        }
    $scope.gliderPaths =$localStorage.gliderPaths;
    //$scope.gliderPoints =$localStorage.gliderPoints;
    console.log($scope.gliderPaths)
    }*/

//REALIZA EL SMOOTH: YA CORRECTO
	$scope.getAllIndexes = function (arr, val) { //prestada
	    var indexes = [], i;
	    for(i = 0; i < arr.length; i++)
	        if (arr[i] === val)
	            indexes.push(i);
	    return indexes;
	}

    $scope.smooth = function (){
        for (var t=0; t<$scope.arrayLines.length; t++){
            var latlong = $localStorage.gliderPaths[$scope.arrayLines[t]]['latlngs']
            console.log(latlong)

            var oldLong = [];
            var lat=[];
            for (var i=0; i<latlong.length; i++){
                oldLong.push(latlong[i]['lng'])
                lat.push(latlong[i]['lat'])
            }
            var longNew = oldLong;
            if(oldLong.includes(0)){
            	var pos_long = $scope.getAllIndexes(oldLong, 0);
            	console.log(pos_long)
                for (var t=0; t<oldLong.length; t++){
	                	if(pos_long.includes(t)){
	                		longNew[t] = oldLong[t-2]
	                	}else{
	                		longNew[t] = oldLong[t]
	                	}
                    }
                }

            var newValues = []; //reseted path
            for(var h=0; h<oldLong.length; h++){
                var newValuesObj = new Object;
                newValuesObj['lat'] = lat[h]
                newValuesObj['lng'] = longNew[h]
                newValues.push(newValuesObj);
                $localStorage.newValues = newValues;
            }
            console.log($scope.arrayLines)
            console.log($scope.gliderPaths)
            console.log($scope.gliderPaths[$scope.arrayLines])//undefined?
            console.log($scope.arrayLines[t]) //undefined? this is why it is not reseted
            
            //reseteo deriva original
            $scope.gliderPaths[$scope.arrayLines] = {
                        color: $scope.getRandomColor(),
                        weight: $scope.getRandomInt(1,5),
                        latlngs: newValues
                    }
            $localStorage.gliderPaths[$scope.arrayLines] = $scope.gliderPaths[$scope.arrayLines] //cambio permanente    
            $scope.gliderPaths =$localStorage.gliderPaths;
        }      
    }

//ELIMINAR EL RUIDO DE LA ZODIAC: TODO OK
    $scope.sepeed_getAllIndexes = function (arr, val) { //prestada
	    var indexes = [], i;
	    for(i = 0; i < arr.length; i++)
	        if (arr[i] > val)
	            indexes.push(i);
	    return indexes;
	}

    $scope.blowNoise = function (){
        //finding noise via velocity check
        for (var i=0; i<$localStorage.gliders.length; i++){
            var speed = $localStorage.gliders[i].speed;
            var latlong = $localStorage.gliders[i].latlong
            console.log($localStorage.gliders[i].id)

            var a=$scope.sepeed_getAllIndexes(speed,2); //posiciones v>2m/s
            console.log('original'+a)
            
            //fixed-end
            if(a[a.length-1]<speed.length-1 && a[a.length-1]>speed.length-6){
              for(var g=a[a.length-1]; g<speed.length; g++){
                a.push(g)
              }
            }

            console.log('fixed end'+a)
            //fixed-origin
            if(a[0]>0 && a[0]<5){
              for(var g=0; g<a[0]; g++){
                a.push(g)
              }
            }
            console.log('fixed origin'+ a)

            var uniqueArray = a.filter(function(item, position) {
                return a.indexOf(item) == position;
            })
            console.log(uniqueArray)

          if(uniqueArray.length>4){//para las primeras 14 derivas eso parece
            	var NewLatlongs=[]; 
	            for(var k=0; k<speed.length; k++){
	              if(uniqueArray.includes(k)===false){
	                NewLatlongs.push(latlong[k])
	              }
	            }
	            console.log('newlatlongs: '+NewLatlongs)
	            console.log(i)
	            console.log('antigualatlongs: '+$localStorage.gliders[i]["latlong"])
            	$localStorage.gliders[i]["latlong"] = NewLatlongs; //reseteo original
            	console.log('¿reseted? check if'+$localStorage.gliders[i]["latlong"])
           
            var newValues = []; //reseted path
            
            console.log(NewLatlongs.length)
            
            for(var h=0; h<NewLatlongs.length; h++){
                var newValuesObj = new Object;
                console.log(NewLatlongs[h][0]) //da problemas con la deriva numero 11 con valores nulos de latitud y longitud
                newValuesObj['lat'] = NewLatlongs[h][0]
                console.log(NewLatlongs[h][1])
                newValuesObj['lng'] = NewLatlongs[h][1]
                newValues.push(newValuesObj);
            } 
            
            //there is no 0 point or line
            $scope.gliderPaths['l'+(i+1)] = {
                        color: $scope.getRandomColor(),
                        weight: $scope.getRandomInt(1,5),
                        latlngs: newValues
                    }
            
            $scope.gliderPoints['p'+(i+1)] = {
                        lat: NewLatlongs[NewLatlongs.length-1][0], 
                        lng: NewLatlongs[NewLatlongs.length-1][1]
                    }
            //lo que sigue se puede quitar cuando se vea si el filtrado es correcto
            }
        }

    } //BLOCK BUTTON AFTER THAT
 
}]);

app.controller('statsViewController', ['$scope', 'leafletData', '$localStorage', function ($scope, leafletData, $localStorage) {
    //METER GRAFICAS DE ROSA D ELOS VIENTOS EN EL CURRENT SCOPE
    $scope.gliders = $localStorage.gliders
    $scope.newPage = function (){
    location.href = '#/views/campañas';
    };

    //montar todas las traces y por cada una sacar un panel con una rosa de vientos.
    //trace in traces?
    $scope.windRosePlots = function(){
        var trace_r = []; var trace_t = [];var trace = []
        var trace_r_curr = []; var trace_t_curr = [];var trace_curr = []

        for (var i=0; i<$scope.gliders.length; i++){
            console.log($scope.gliders[i].windMean)
            if($scope.gliders[i].windMean[0] != null){
                var obj = new Object;
                var obj_curr = new Object;
                trace_r.push($scope.gliders[i].windInterp[0]);
                trace_t.push($scope.gliders[i].windInterp[1]); 
                console.log($scope.gliders[i].windInterp[1])
                console.log($scope.gliders[i].windInterp[0])
                obj['pos'] = i
                obj['data'] = [{r:$scope.gliders[i].windInterp[0] , t:$scope.gliders[i].windInterp[1], type: 'area'}]
                obj['layout'] = {
                                  title: 'Wind Speed Distribution in Laurel, NE',
                                  font: {size: 16},
                                  legend: {font: {size: 16}},
                                  radialaxis: {ticksuffix: '%'},
                                  orientation: 270
                                }
                trace.push(obj) 
                $scope.trace = trace
                
                trace_r_curr.push($scope.gliders[i].currentInterp[0]);
                trace_t_curr.push($scope.gliders[i].currentInterp[1]); 
                obj_curr['pos'] = i
                obj_curr['data'] = [{r:$scope.gliders[i].currentInterp[0] , t:$scope.gliders[i].currentInterp[1], type: 'area'}]
                obj_curr['layout'] = {
                                  title: 'Wind Speed Distribution in Laurel, NE',
                                  font: {size: 16},
                                  legend: {font: {size: 16}},
                                  radialaxis: {ticksuffix: '%'},
                                  orientation: 270
                                }
                trace_curr.push(obj_curr) 
                $scope.trace_curr = trace_curr
                console.log($scope.trace_curr)
                console.log($scope.gliders[i])
            }
        } 
    }

    $scope.windRosePlots()

    $scope.draw = function(){
        for (j=0; j<$scope.trace.length; j++){
            Plotly.newPlot('WindRose'+j, $scope.trace[j].data, $scope.trace[j].layout);
            Plotly.newPlot('currentRose'+j, $scope.trace_curr[j].data, $scope.trace_curr[j].layout);
        }
    }
    $scope.draw()

        
}]);

//NOTAS:
//ORDENAR OPERACIONE SPOR SCOPE: ALCANCE: TODAS LAS DERIVAS VS PARTICULARES
//hacer histograma de frecuencias de derivas por año. 
//hacer histograma de frecuencias de boyas y tiempo distancia acumulada;
//hacer histograma de <div ng-repeat="band in bands | filter: myFilter | filter: {name: nameFilter}"
//<input type="text" ng-model="nameFilter" class="form-control" placeholder="group name"></input>

    //PANEL DE ESTADISTICAS DE ESAS DERIVAS:
    //DIAGRAMA DE FRECUENCIAS/INTENSIDAD DE VIENTOS SEGUN BEUFORT
    //DIAGRAMA DE FRECUENCIA/INTENSIDAD DE CORRIENTES 
    //DIAGRAMA FUERZA PREDOMINANTE???

// FIRST KNOWING THE DATA TO FILTER PROPERLY AFTER;
// DOGNUTS YEARS?? OR DIAGRAMA DE FRECUENCIAS;
// WIND INTENSITY VS YEAR <-------------
// CURRENT INTENSITY;

//PROBAR A SACAR VARIOS GRAFICOS; LUEGO YA SE VE DONDE COLOCARLOS

//filtrar por nombre: coger solo los de esos meses y años; 
//y calcular los paths de esas derivas; (no otra vez lectura masiva y calculo de gliders; locura)
//poner más que un input; checkboxes con angular para filtrar; mejor no?

//NOTAS VARIAS: SI LOS PATHS LOS CREO CON LA ID; PUEDO HACER UN SPLICE DE LAS DERIVAS QUE NO QUIERO REPRESENTAR
//REVERTIR SPLICE CON UN PUSH DE LOS REMOVIDOS EN LOS FILTRADOS ANTERIORES;
//IGULA ES MAS RAPIDO QUE RECREAR TODAS LAS DERIVAS

//LEGEND EN LEAFLET; MOLARIA PARA MOSTRAR EL RUIDO
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/basic/hide-show-map-example
//http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/basic/tiles-zoom-changer-example
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/basic/tiles-example


//OJO QUE SE LE PUEDE PORNER NOMBRE!!!layer: 'test';
//SI SE LE PUEDE PONER NOMBRE SE PUEDE FILTRAR DIRECTAMENTE SOBRE EL SCOPE DE
//LOS PATHS!!!!!!!!!!!!!!
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/paths/change-in-group-layer-example
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/paths/decorations-simple-example
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/paths/events-example-with-id
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/controls/custom-layer-control-example

//ojo: hover: title;
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/controls/search-example

//BLOWNOISE??
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/markers/modal-markercluster-example

//LOOK AT MARKERS;
//http://tombatossals.github.io/angular-leaflet-directive/examples/0000-viewer.html#/mixed/overlays-markers-nested-no-watch-example


//POP UP: AÑADIR HTML EN MESSAGE;
//A leaflet popup requires that the content it displays is either html or string. If you do things the way you are, you are returning a promise and leaflet does not know how to deal with this.
//https://github.com/tombatossals/angular-leaflet-directive/issues/866